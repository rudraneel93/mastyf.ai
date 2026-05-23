import { describe, expect, it } from 'vitest';
import { replayDraftRule, type PolicyCopilotReplayMatrix } from '../../src/ai/policy-copilot.js';
import type { PolicyRule } from '../../src/policy/policy-types.js';

describe('PolicyCopilot', () => {
  it('replays draft rule against corpus fixtures', () => {
    const rule: PolicyRule = {
      name: 'copilot-test-block-shell',
      action: 'block',
      tools: { deny: ['execute_command', 'bash', 'run'] },
    };
    const matrix: PolicyCopilotReplayMatrix = replayDraftRule(rule, { corpusLimit: 10 });
    expect(matrix.total).toBeGreaterThan(0);
    expect(matrix.results.some((r) => r.source === 'corpus')).toBe(true);
    expect(matrix.results.every((r) => ['block', 'flag', 'pass'].includes(r.actual))).toBe(true);
  });

  it('rejects invalid draft rules from staging', () => {
    const rule: PolicyRule = {
      name: '',
      action: 'block',
      patterns: ['[invalid'],
    };
    const matrix = replayDraftRule(rule, { corpusLimit: 5 });
    expect(matrix.readyForReview).toBe(false);
    expect(matrix.blockReason).toBeTruthy();
  });
});
