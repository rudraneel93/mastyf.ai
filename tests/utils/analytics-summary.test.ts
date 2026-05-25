import { describe, expect, it } from 'vitest';
import type { ProxyCallRecord } from '../../src/types.js';

// Test pure aggregation helpers via buildAnalyticsSummary with mock would need DB;
// test label helpers indirectly through exported types usage in integration.
import { detectProvider } from '../../src/utils/token-counter.js';

function rec(partial: Partial<ProxyCallRecord>): ProxyCallRecord {
  return {
    serverName: 'test',
    toolName: 'read',
    timestamp: new Date().toISOString(),
    blocked: false,
    requestTokens: 100,
    responseTokens: 50,
    totalTokens: 150,
    durationMs: 120,
    costUsd: 0.01,
    model: 'gpt-4o',
    ...partial,
  } as ProxyCallRecord;
}

describe('analytics-summary helpers', () => {
  it('detectProvider maps models for provider costs', () => {
    expect(detectProvider('gpt-4o')).toBe('openai');
    expect(detectProvider('claude-3-5-sonnet')).toBe('anthropic');
    expect(detectProvider('gemini-pro')).toBe('google');
  });

  it('fixture records have expected token totals', () => {
    const records = [rec({}), rec({ model: 'claude-3-5-sonnet', costUsd: 0.02 })];
    const tokens = records.reduce(
      (s, r) => s + (r.requestTokens || 0) + (r.responseTokens || 0),
      0,
    );
    expect(tokens).toBe(300);
  });
});
