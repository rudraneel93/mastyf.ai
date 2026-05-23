import { describe, it, expect } from 'vitest';
import { getOrCreatePolicyEngine, resetPolicyEngineCacheForTests } from '../../src/policy/policy-engine-cache.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const BASE: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    default_action: 'block',
    rules: [{ name: 'test-rule', action: 'block', patterns: ['secret'] }],
  },
};

describe('policy-engine-cache', () => {
  it('returns same engine instance for identical config', () => {
    resetPolicyEngineCacheForTests();
    const a = getOrCreatePolicyEngine(BASE);
    const b = getOrCreatePolicyEngine(BASE);
    expect(a).toBe(b);
  });

  it('creates new engine when config changes', () => {
    resetPolicyEngineCacheForTests();
    const a = getOrCreatePolicyEngine(BASE);
    const b = getOrCreatePolicyEngine({
      ...BASE,
      policy: { ...BASE.policy, mode: 'audit' },
    });
    expect(a).not.toBe(b);
  });
});
