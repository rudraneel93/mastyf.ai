/**
 * OAuth JWT revocation denylist (jti / token hash).
 * Memory always; Redis when configured (GUARDIAN_TOKEN_REVOCATION_REDIS=true).
 */
import { createHash } from 'crypto';
import type { Redis, Cluster } from 'ioredis';
import { Logger } from '../utils/logger.js';
import { createRedisClient, isRedisConfigured } from '../utils/redis-client.js';

const memoryDenylist = new Map<string, number>();
const DEFAULT_TTL_MS = 86_400_000;
const REDIS_KEY_PREFIX = 'guardian:revoked:';

let revocationRedis: Redis | Cluster | null = null;

function keyForToken(token: string, jti?: string): string {
  if (jti) return `jti:${jti}`;
  return `hash:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;
}

function ttlMs(): number {
  const n = parseInt(process.env['GUARDIAN_TOKEN_REVOCATION_TTL_MS'] || String(DEFAULT_TTL_MS), 10);
  return Number.isFinite(n) && n > 60_000 ? n : DEFAULT_TTL_MS;
}

function useRedisRevocation(): boolean {
  return (
    process.env['GUARDIAN_TOKEN_REVOCATION'] !== 'false'
    && process.env['GUARDIAN_TOKEN_REVOCATION_REDIS'] !== 'false'
    && isRedisConfigured()
  );
}

function getRevocationRedis(): Redis | Cluster | null {
  if (!useRedisRevocation()) return null;
  if (!revocationRedis) {
    revocationRedis = createRedisClient({ maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return revocationRedis;
}

function redisKey(key: string): string {
  return `${REDIS_KEY_PREFIX}${key}`;
}

export async function revokeBearerToken(token: string, jti?: string): Promise<void> {
  const key = keyForToken(token, jti);
  const exp = Date.now() + ttlMs();
  memoryDenylist.set(key, exp);
  const redis = getRevocationRedis();
  if (redis) {
    try {
      await redis.set(redisKey(key), '1', 'PX', ttlMs());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Logger.warn(`[auth] Redis token revocation write failed: ${msg}`);
    }
  }
  Logger.info(`[auth] Token revoked: ${jti || key.slice(0, 12)}`);
}

export async function isBearerTokenRevoked(token: string, jti?: string): Promise<boolean> {
  if (process.env['GUARDIAN_TOKEN_REVOCATION'] === 'false') return false;
  const key = keyForToken(token, jti);
  const exp = memoryDenylist.get(key);
  if (exp) {
    if (Date.now() > exp) {
      memoryDenylist.delete(key);
    } else {
      return true;
    }
  }

  const redis = getRevocationRedis();
  if (redis) {
    try {
      const hit = await redis.get(redisKey(key));
      if (hit) return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Logger.warn(`[auth] Redis token revocation read failed: ${msg}`);
    }
  }
  return false;
}

export function cleanupRevokedTokens(): void {
  const now = Date.now();
  for (const [k, exp] of memoryDenylist) {
    if (now > exp) memoryDenylist.delete(k);
  }
}

/** @internal */
export function resetTokenRevocationForTests(): void {
  memoryDenylist.clear();
  if (revocationRedis) {
    revocationRedis.disconnect();
    revocationRedis = null;
  }
}
