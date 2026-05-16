import { describe, it, expect } from 'vitest';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('HistoryDatabase GDPR erasure', () => {
  it('eraseAllAuditData removes all rows', async () => {
    const db = new HistoryDatabase(':memory:');
    await db.addCallRecord({
      serverName: 'srv',
      toolName: 'search',
      requestTokens: 10,
      responseTokens: 20,
      totalTokens: 30,
      durationMs: 5,
      timestamp: new Date().toISOString(),
    });
    await db.addCostRecord('srv', 30, 0.01);
    await db.addSecurityScan('srv', 90, 0, {});
    await db.addHealthCheck('srv', 12, true, 3);

    const counts = db.eraseAllAuditData();
    expect(counts.callRecords).toBe(1);
    expect(counts.costRecords).toBe(1);
    expect(counts.securityScans).toBe(1);
    expect(counts.healthChecks).toBe(1);

    const records = await db.getCallRecordsForServer('srv');
    expect(records).toHaveLength(0);
    db.close();
  });
});
