import { describe, it, expect } from 'vitest';
import { injectRotatedSessionIntoResult } from '../../src/utils/mcp-session-meta.js';

describe('injectRotatedSessionIntoResult', () => {
  it('sets sessionToken on result _meta', () => {
    const msg = { jsonrpc: '2.0', id: 1, result: { data: 'x' } };
    injectRotatedSessionIntoResult(msg, 'tok-rotated');
    expect((msg.result as { _meta: { sessionToken: string } })._meta.sessionToken).toBe('tok-rotated');
  });

  it('no-ops without token or result', () => {
    const msg = { jsonrpc: '2.0', id: 1, error: { code: 1, message: 'x' } };
    injectRotatedSessionIntoResult(msg, 'tok');
    expect(msg.result).toBeUndefined();
  });
});
