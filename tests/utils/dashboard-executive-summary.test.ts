import { describe, expect, it } from 'vitest';
import { buildExecutiveSummary } from '../../src/utils/dashboard-executive-summary.js';
import type { IDatabase } from '../../src/database/database-interface.js';
import type { ProxyCallRecord } from '../../src/types.js';

function mockDb(records: ProxyCallRecord[]): IDatabase {
  return {
    getDistinctActiveServers: async () => ['test-server'],
    getCallRecordsForServer: async () => records,
  } as unknown as IDatabase;
}

describe('buildExecutiveSummary', () => {
  it('computes pass rate and cost from records', async () => {
    const now = Date.now();
    const records: ProxyCallRecord[] = [
      {
        serverName: 'test-server',
        toolName: 'read',
        blocked: false,
        costUsd: 0.01,
        requestTokens: 10,
        responseTokens: 5,
        totalTokens: 15,
        durationMs: 20,
        timestamp: new Date(now - 3600000).toISOString(),
      },
      {
        serverName: 'test-server',
        toolName: 'write',
        blocked: true,
        costUsd: 0,
        requestTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        durationMs: 5,
        timestamp: new Date(now - 1800000).toISOString(),
      },
    ];
    const summary = await buildExecutiveSummary(mockDb(records), 'default', 7);
    expect(summary.totalRequests).toBe(2);
    expect(summary.blockedRequests).toBe(1);
    expect(summary.passRatePct).toBe(50);
    expect(summary.totalCostUsd).toBeGreaterThan(0);
    expect(summary.windowDays).toBe(7);
    expect(summary.meta.recordCount).toBe(2);
    expect(summary.comparison).toBeDefined();
    expect(summary.sparklines?.totalCalls.length).toBeGreaterThan(0);
  });
});
