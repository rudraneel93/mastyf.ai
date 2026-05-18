import { describe, it, expect } from 'vitest';
import { claimDpopJtiOnRedis } from '../../src/auth/dpop-nonce-store.js';

/** Minimal Redis SET/GET/DEL mock for distributed-lock claim tests. */
class MockRedis {
  private store = new Map<string, string>();

  async set(key: string, val: string, ...args: string[]): Promise<'OK' | null> {
    const nx = args.includes('NX');
    if (nx && this.store.has(key)) return null;
    this.store.set(key, val);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

describe('claimDpopJtiOnRedis', () => {
  it('allows first claim and rejects replay', async () => {
    const redis = new MockRedis();
    const prefix = 'test:dpop:';
    expect(await claimDpopJtiOnRedis(redis, prefix, 'abc', 3600)).toBe(true);
    expect(await claimDpopJtiOnRedis(redis, prefix, 'abc', 3600)).toBe(false);
  });

  it('allows only one winner under concurrent claims', async () => {
    const redis = new MockRedis();
    const prefix = 'test:dpop:';
    const results = await Promise.all(
      Array.from({ length: 25 }, () => claimDpopJtiOnRedis(redis, prefix, 'race-jti', 3600)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
