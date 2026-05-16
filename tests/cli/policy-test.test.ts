import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { runPolicyTest } from '../../src/cli/policy-test.js';

const defaultPolicy = join(process.cwd(), 'default-policy.yaml');

describe('policy test CLI', () => {
  it('returns JSON decision for a tool call', () => {
    const result = runPolicyTest({
      policy: defaultPolicy,
      tool: 'read_file',
      args: JSON.stringify({ path: '/etc/passwd' }),
      server: 'test',
    });
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('rule');
    expect(result).toHaveProperty('reason');
    expect(['pass', 'block', 'flag']).toContain(result.action);
  });
});
