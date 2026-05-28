import { describe, expect, it } from 'vitest';
import { buildSimilarEnvironmentBenchmarks } from '../../src/ai/similar-environment-benchmarks.js';

describe('similar environment benchmarks', () => {
  it('computes per-server benchmark comparisons', () => {
    const rows = buildSimilarEnvironmentBenchmarks([
      { serverName: 'a', toolName: 'read', requestTokens: 1, responseTokens: 1, totalTokens: 2, durationMs: 10, timestamp: new Date().toISOString(), blocked: true },
      { serverName: 'a', toolName: 'read', requestTokens: 1, responseTokens: 1, totalTokens: 2, durationMs: 12, timestamp: new Date().toISOString(), blocked: false },
      { serverName: 'b', toolName: 'read', requestTokens: 1, responseTokens: 1, totalTokens: 2, durationMs: 40, timestamp: new Date().toISOString(), blocked: false },
    ]);
    expect(rows.length).toBe(2);
    expect(rows[0]!.totalCalls).toBeGreaterThan(0);
    expect(['outperforming', 'neutral', 'needs_attention']).toContain(rows[0]!.status);
  });
});
