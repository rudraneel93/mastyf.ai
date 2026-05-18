import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig, CallContext } from '../../src/policy/policy-types.js';

const rateLimitPolicy: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'audit',
    rules: [
      {
        name: 'rate-limit',
        action: 'flag',
        maxCallsPerMinute: 1000,
      },
    ],
  },
};

function makeContext(i: number): CallContext {
  return {
    serverName: 'mem-test',
    toolName: 'tool',
    arguments: {},
    requestId: `req-${i}`,
    requestTokens: 1,
    timestamp: new Date().toISOString(),
    agentIdentity: { sub: `user-${i}`, clientId: `client-${i}` },
  };
}

describe('PolicyEngine memory bounds', () => {
  it('keeps rate-limit LRU at max entries after many unique clients', () => {
    const engine = new PolicyEngine(rateLimitPolicy);
    const counters = (engine as unknown as { callCounters: { size: number; max: number } })
      .callCounters;

    for (let i = 0; i < 120_000; i++) {
      engine.evaluate(makeContext(i));
    }

    expect(counters.size).toBeLessThanOrEqual(counters.max);
    expect(counters.size).toBe(counters.max);
  });
});
