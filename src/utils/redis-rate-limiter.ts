import { Redis } from 'ioredis';
import { Logger } from './logger.js';
import { getGuardianRegion } from './region.js';

/**
 * Redis-backed rate limit counters for multi-replica HA.
 * Keys include GUARDIAN_REGION for observability and active-passive isolation.
 * Enable with: REDIS_URL=redis://localhost:6379
 */
let sharedLimiter: RedisRateLimiter | null = null;

export function getSharedRedisRateLimiter(): RedisRateLimiter {
  if (!sharedLimiter) {
    sharedLimiter = new RedisRateLimiter();
  }
  return sharedLimiter;
}

export function resetRedisRateLimiterForTests(): void {
  sharedLimiter = null;
}

export class RedisRateLimiter {
  private redis: Redis;
  private prefix: string;
  private lockPrefix: string;
  private region: string;
  private local: Map<string, { count: number; resetAt: number }> = new Map();

  constructor() {
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    this.region = getGuardianRegion();
    this.prefix = `mcp_guardian:ratelimit:${this.region}:`;
    this.lockPrefix = `mcp_guardian:ratelimit_lock:${this.region}:`;
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
    Logger.info(`[redis-rate-limiter] Connected to ${redisUrl} (region=${this.region})`);
  }

  getRegion(): string {
    return this.region;
  }

  /**
   * Optional distributed lock for rate-limit window coordination (active-passive).
   * Returns true if lock acquired or lock not required.
   */
  async acquireWindowLock(key: string, windowMs: number): Promise<boolean> {
    if (process.env['GUARDIAN_RATE_LIMIT_DISTRIBUTED_LOCK'] !== 'true') return true;
    const lockKey = `${this.lockPrefix}${key}`;
    try {
      const ok = await this.redis.set(lockKey, '1', 'PX', windowMs, 'NX');
      return ok === 'OK';
    } catch (err: any) {
      Logger.debug(`[redis-rate-limiter] lock acquire failed: ${err?.message}`);
      return true;
    }
  }

  /**
   * Check and increment a rate limit counter (atomic INCR across replicas).
   */
  async checkAndIncrement(
    key: string,
    maxRequests: number,
    windowMs: number = 60000,
  ): Promise<{ allowed: boolean; count: number }> {
    const redisKey = `${this.prefix}${key}`;

    try {
      const hasLock = await this.acquireWindowLock(key, windowMs);
      if (!hasLock) {
        return { allowed: false, count: maxRequests + 1 };
      }

      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.pexpire(redisKey, windowMs);
      }

      const now = Date.now();
      let localCounter = this.local.get(key);
      if (!localCounter || now > localCounter.resetAt) {
        localCounter = { count: 1, resetAt: now + windowMs };
      } else {
        localCounter.count++;
      }
      this.local.set(key, localCounter);

      return { allowed: count <= maxRequests, count };
    } catch (err: any) {
      if (process.env['GUARDIAN_STRICT_MODE'] === 'true') {
        Logger.error(`[redis-rate-limiter] Redis unavailable in strict mode: ${err?.message}`);
        return { allowed: false, count: maxRequests + 1 };
      }
      Logger.debug(`[redis-rate-limiter] Redis error, using local: ${err?.message}`);
      const now = Date.now();
      let localCounter = this.local.get(key);
      if (!localCounter || now > localCounter.resetAt) {
        localCounter = { count: 1, resetAt: now + windowMs };
      } else {
        localCounter.count++;
      }
      this.local.set(key, localCounter);
      return { allowed: localCounter.count <= maxRequests, count: localCounter.count };
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
