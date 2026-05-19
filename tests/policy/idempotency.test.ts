import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PolicyConfig } from '../../src/policy/policy-types.js';
import {
  hashIdempotentPayload,
  isDuplicateIdempotentRequest,
  resetIdempotencyStoreForTests,
} from '../../src/policy/idempotency-store.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultPolicy = load(
  readFileSync(resolve(__dir, '../../default-policy.yaml'), 'utf-8'),
) as PolicyConfig;

describe('idempotency replay', () => {
  beforeEach(() => {
    resetIdempotencyStoreForTests();
  });

  afterEach(() => {
    resetIdempotencyStoreForTests();
  });

  it('detects duplicate keys in memory store', async () => {
    const key = hashIdempotentPayload('t1', 'srv', 'tool', { a: 1 }, 'idem-1');
    expect(await isDuplicateIdempotentRequest(key, 't1')).toBe(false);
    expect(await isDuplicateIdempotentRequest(key, 't1')).toBe(true);
  });

  it('blocks duplicate tools/call in block mode via evaluateAsync', async () => {
    const blockPolicy: PolicyConfig = {
      ...defaultPolicy,
      policy: { ...defaultPolicy.policy, mode: 'block', rules: [], default_action: 'pass' },
    };
    const engine = new PolicyEngine(blockPolicy);
    const base = {
      serverName: 's',
      toolName: 'echo',
      arguments: { x: 1 },
      requestId: '1',
      requestTokens: 1,
      timestamp: new Date().toISOString(),
      tenantId: 'default',
      idempotencyKey: 'key-abc',
    };
    const first = await engine.evaluateAsync(base);
    expect(first.action).not.toBe('block');
    const second = await engine.evaluateAsync({ ...base, requestId: '2' });
    expect(second.action).toBe('block');
    expect(second.rule).toBe('idempotency-replay');
  });
});
