import { describe, it, expect } from 'vitest';
import { InMemoryDPoPNonceStore } from '../../src/auth/dpop-nonce-store.js';

describe('DPoP nonce store', () => {
  it('claim rejects replay (SETNX-equivalent)', async () => {
    const store = new InMemoryDPoPNonceStore(60_000);
    expect(await store.claim('jti-1')).toBe(true);
    expect(await store.claim('jti-1')).toBe(false);
    expect(await store.claim('jti-2')).toBe(true);
  });

  it('concurrent claims allow only one winner per jti', async () => {
    const store = new InMemoryDPoPNonceStore(60_000);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store.claim('jti-race')),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((r) => !r)).toHaveLength(19);
  });
});
