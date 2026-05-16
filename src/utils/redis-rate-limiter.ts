import { Redis } from 'ioredis';
import { Logger } from './logger.js';

/**
 * Redis-backed rate limit counters for multi-replica HA.
 * Extends the in-memory counters with shared Redis state.
 * Enable with: REDIS_URL=redis://localhost:6379
 */
let sharedLimiter: RedisRateLimiter | null = null;

export function getSharedRedisRateLimiter(): RedisRateLimiter {
  if (!sharedLimiter) {
    sharedLimiter = new RedisRateLimiter();
  }
  return sharedLimiter;
}

export class RedisRateLimiter {
  private redis: Redis;
  private prefix = 'mcp_guardian:ratelimit:';
  private local: Map<string, { count: number; resetAt: number }> = new Map();

  constructor() {
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
    Logger.info(`[redis-rate-limiter] Connected to ${redisUrl}`);
  }

  /**
   * Check and increment a rate limit counter.
   * Returns the new count, or -1 if the limit is exceeded.
   * Counter resets every windowMs milliseconds.
   */
  async checkAndIncrement(key: string, maxRequests: number, windowMs: number = 60000): Promise<{ allowed: boolean; count: number }> {
    const redisKey = `${this.prefix}${key}`;

    try {
      // Use Redis MULTI for atomic increment + TTL
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.pexpire(redisKey, windowMs);
      }

      // Also update local for fast reads
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