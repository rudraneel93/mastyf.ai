import { describe, expect, it } from 'vitest';
import type { StoredSemanticAudit } from '../../src/ai/semantic-audit-store.js';
import { runTribunalDebate } from '../../src/ai/swarm-debate-tribunal.js';

const mockRecord: StoredSemanticAudit = {
  id: 'trib-1',
  tenantId: 'default',
  requestId: 'r1',
  serverName: 'filesystem',
  toolName: 'read_file',
  syncDecision: { action: 'block', rule: 'path-guard', reason: 'blocked' },
  semanticAudit: {
    suspicious: true,
    confidence: 0.62,
    categories: ['path-traversal'],
    reasoning: 'borderline path read',
  },
  timestamp: new Date().toISOString(),
};

describe('swarm-debate-tribunal', () => {
  it('runs heuristic tribunal debate without LLM', async () => {
    const debate = await runTribunalDebate(mockRecord, { useLlm: false });
    expect(debate.arguments.length).toBe(3);
    expect(debate.verdict.recommendedLabel).toBeTruthy();
    expect(debate.transcript.length).toBeGreaterThan(0);
  });
});
