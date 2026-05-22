import { describe, it, expect } from 'vitest';
import { parseOpaResult } from '../../src/policy/opa-policy.js';

describe('parseOpaResult', () => {
  it('accepts allow boolean', () => {
    expect(parseOpaResult({ allow: true })).toEqual({ ok: true, allow: true, reason: undefined });
    expect(parseOpaResult({ allow: false, reason: 'denied' })).toEqual({
      ok: true,
      allow: false,
      reason: 'denied',
    });
  });

  it('rejects invalid shapes', () => {
    expect(parseOpaResult({ allow: 'yes' }).ok).toBe(false);
    expect(parseOpaResult(null).ok).toBe(false);
  });
});
