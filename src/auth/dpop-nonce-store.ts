import type { Redis, Cluster } from 'ioredis';
import { Logger } from '../utils/logger.js';
import { createRedisClient, getRedisConnectionLabel, isRedisConfigured } from '../utils/redis-client.js';

/** Pluggable DPoP jti replay store (in-memory single instance or Redis HA). */
export interface DPoPNonceStore {
  /** Returns true if this jti is the first use; false if replay. */
  claim(jti: string): Promise<boolean>;
  cleanupExpired?(): void;
}

export class InMemoryDPoPNonceStore implements DPoPNonceStore {
  private used = new Map<string, number>();
  private lastCleanup = Date.now();

  constructor(private readonly ttlMs: number) {}

  cleanupExpired(): void {
    const now = Date.now();
    if (now - this.lastCleanup < 60_000) return;
    const expiry = now - this.ttlMs;
    for (const [jti, ts] of this.used) {
      if (ts < expiry) this.used.delete(jti);
    }
    this.lastCleanup = now;
  }

  async claim(jti: string): Promise<boolean> {
    this.cleanupExpired();
    if (this.used.has(jti)) return false;
    this.used.set(jti, Date.now());
    return true;
  }
}

const DPOP_LOCK_MAX_ATTEMPTS = 3;
const DPOP_LOCK_BASE_DELAY_MS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Redis claim with short-lived lock — reduces replay window under replication lag. */
export async function claimDpopJtiOnRedis(
  redis: Pick<Redis, 'set' | 'get' | 'del'>,
  keyPrefix: string,
  jti: string,
  ttlSeconds: number,
): Promise<boolean> {
  const lockKey = `${keyPrefix}lock:${jti}`;
  const dataKey = `${keyPrefix}${jti}`;

  for (let attempt = 0; attempt < DPOP_LOCK_MAX_ATTEMPTS; attempt++) {
    const locked = await redis.set(lockKey, '1', 'EX', 1, 'NX');
    if (locked !== 'OK') {
      await sleep(DPOP_LOCK_BASE_DELAY_MS * 2 ** attempt);
      continue;
    }
    try {
      const existing = await redis.get(dataKey);
      if (existing) return false;
      const ok = await redis.set(dataKey, '1', 'EX', ttlSeconds, 'NX');
      return ok === 'OK';
    } finally {
      await redis.del(lockKey);
    }
  }
  return false;
}

export class RedisDPoPNonceStore implements DPoPNonceStore {
  private redis: Redis | Cluster;
  private readonly prefix = 'mcp_guardian:dpop:jti:';

  constructor(
    private readonly ttlSeconds: number,
    redis?: Redis | Cluster,
  ) {
    this.redis = redis ?? createRedisClient({ maxRetriesPerRequest: 3, lazyConnect: false });
    Logger.info(`[dpop] Redis nonce store (${getRedisConnectionLabel()})`);
  }

  async claim(jti: string): Promise<boolean> {
    return claimDpopJtiOnRedis(this.redis, this.prefix, jti, this.ttlSeconds);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export function createDPoPNonceStore(ttlMs: number): DPoPNonceStore {
  if (isRedisConfigured()) {
    return new RedisDPoPNonceStore(Math.ceil(ttlMs / 1000));
  }
  return new InMemoryDPoPNonceStore(ttlMs);
}
