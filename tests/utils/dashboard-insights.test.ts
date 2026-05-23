import { describe, expect, it } from 'vitest';
import { buildDeterministicInsightsOnly } from '../../src/utils/dashboard-insights.js';
import type { ExecutiveSummary } from '../../src/utils/dashboard-executive-summary.js';

const summary: ExecutiveSummary = {
  timestamp: new Date().toISOString(),
  totalRequests: 100,
  blockedRequests: 10,
  passedRequests: 90,
  passRatePct: 90,
  blockRatePct: 10,
  totalCostUsd: 0.5,
  burnRatePerHour: 0.01,
  projectedMonthlyUsd: 7.2,
  avgLatencyMs: 45,
  activeServers: 2,
  budgetUsd: 10,
  budgetUtilizationPct: 5,
  runwayDays: 40,
  topServersByCost: [{ server: 'fs', costUsd: 0.5, calls: 50 }],
  topToolsByCalls: [{ tool: 'read_file', calls: 40 }],
};

describe('buildDeterministicInsightsOnly', () => {
  it('returns cost bullets from summary', () => {
    const insights = buildDeterministicInsightsOnly('cost', summary);
    expect(insights.source).toBe('measured');
    expect(insights.bullets.length).toBeGreaterThan(0);
    expect(insights.bullets[0]).toMatch(/Total measured spend/);
    expect(insights.bullets.join(' ')).not.toMatch(/projected/i);
  });

  it('returns overview bullets', () => {
    const insights = buildDeterministicInsightsOnly('overview', summary);
    expect(insights.bullets.some((b) => b.includes('100'))).toBe(true);
  });
});
