import { describe, it, expect } from 'vitest';
import { CallRecordsDbAdapter } from '../../src/utils/call-records-db-adapter.js';
import { buildExecutiveSummary } from '../../src/utils/dashboard-executive-summary.js';
import type { ProxyCallRecord } from '../../src/types.js';

function record(partial: Partial<ProxyCallRecord> & Pick<ProxyCallRecord, 'serverName' | 'toolName'>): ProxyCallRecord {
  const now = new Date().toISOString();
  return {
    requestTokens: 1,
    responseTokens: 1,
    totalTokens: 2,
    durationMs: 5,
    timestamp: now,
    costUsd: 0.01,
    blocked: false,
    tenantId: 'default',
    ...partial,
  };
}

describe('federated executive summary integration', () => {
  it('totals match sum of two replica record sets', async () => {
    const replicaA: ProxyCallRecord[] = [
      record({ serverName: 'github', toolName: 'search', costUsd: 0.02 }),
      record({ serverName: 'github', toolName: 'search', costUsd: 0.03, blocked: true }),
    ];
    const replicaB: ProxyCallRecord[] = [
      record({ serverName: 'slack', toolName: 'post', costUsd: 0.05 }),
    ];
    const merged = [...replicaA, ...replicaB];
    const db = new CallRecordsDbAdapter(merged);

    const summary = await buildExecutiveSummary(db, 'default', 7);
    expect(summary.totalRequests).toBe(3);
    expect(summary.blockedRequests).toBe(1);
    expect(summary.totalCostUsd).toBeCloseTo(0.1, 5);
  });
});
