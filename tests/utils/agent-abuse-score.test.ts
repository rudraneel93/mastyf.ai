import { describe, expect, it } from 'vitest';
import { computeAgentAbuseScore, computeAgentAbuseScores } from '../../src/utils/agent-abuse-score.js';
import type { ProxyCallRecord } from '../../src/types.js';

function record(partial: Partial<ProxyCallRecord>): ProxyCallRecord {
  return {
    serverName: 'test-server',
    toolName: 'read_file',
    requestTokens: 100,
    responseTokens: 50,
    totalTokens: 150,
    durationMs: 10,
    timestamp: new Date().toISOString(),
    blocked: false,
    ...partial,
  };
}

describe('agent-abuse-score', () => {
  it('scores high on block-heavy sessions', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      record({ blocked: i < 7, toolName: i % 2 === 0 ? 'run' : 'read_file' }),
    );
    const score = computeAgentAbuseScore('default:test-server', records, []);
    expect(score.score).toBeGreaterThan(20);
    expect(score.blockedCount).toBe(7);
    expect(['medium', 'high', 'critical']).toContain(score.riskLevel);
  });

  it('ranks sessions by score', () => {
    const noisy = Array.from({ length: 5 }, () => record({ blocked: true }));
    const quiet = Array.from({ length: 5 }, () => record({ blocked: false }));
    const scores = computeAgentAbuseScores(
      [...noisy.map((r, i) => ({ ...r, serverName: 'noisy' })), ...quiet.map((r) => ({ ...r, serverName: 'quiet' }))],
      [],
    );
    expect(scores[0].serverName).toBe('noisy');
  });
});
