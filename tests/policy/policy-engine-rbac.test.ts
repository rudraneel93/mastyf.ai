import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig, CallContext } from '../../src/policy/policy-types.js';

const rbacPolicy: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    default_action: 'pass',
    rules: [
      {
        name: 'require-admin-scope',
        action: 'block',
        rbac: { scopes: ['admin'] },
      },
    ],
  },
};

function ctx(overrides: Partial<CallContext> = {}): CallContext {
  return {
    serverName: 'srv',
    toolName: 'any_tool',
    requestId: '1',
    requestTokens: 10,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('PolicyEngine RBAC', () => {
  const engine = new PolicyEngine(rbacPolicy);

  it('blocks when agent lacks required scope', () => {
    const decision = engine.evaluate(ctx({
      agentIdentity: { sub: 'agent-1', scopes: ['read'] },
    }));
    expect(decision.action).toBe('block');
    expect(decision.reason).toContain('scope');
  });

  it('allows when agent has required scope', () => {
    const decision = engine.evaluate(ctx({
      agentIdentity: { sub: 'admin-1', scopes: ['admin', 'read'] },
    }));
    expect(decision.action).toBe('pass');
  });

  it('blocks when identity missing on rbac rule', () => {
    const decision = engine.evaluate(ctx());
    expect(decision.action).toBe('block');
    expect(decision.reason).toContain('identity');
  });
});
