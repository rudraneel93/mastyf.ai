import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistoryDatabase } from '../../src/database/history-db.js';
import {
  initAuditWriteQueue,
  enqueueAuditWrite,
  flushAuditWriteQueue,
  getAuditQueueDepth,
  resetAuditWriteQueueForTests,
} from '../../src/database/audit-write-queue.js';

describe('audit-write-queue', () => {
  let db: HistoryDatabase;

  beforeEach(() => {
    resetAuditWriteQueueForTests();
    db = new HistoryDatabase(':memory:');
    initAuditWriteQueue(db);
  });

  afterEach(() => {
    resetAuditWriteQueueForTests();
    db.close();
  });

  it('persists records asynchronously after flush', async () => {
    enqueueAuditWrite({
      record: {
        serverName: 'srv',
        toolName: 'read',
        requestTokens: 1,
        responseTokens: 1,
        totalTokens: 2,
        durationMs: 5,
        timestamp: new Date().toISOString(),
      },
    });
    expect(getAuditQueueDepth()).toBeGreaterThan(0);
    await flushAuditWriteQueue();
    expect(getAuditQueueDepth()).toBe(0);
    const rows = await db.getCallRecordsForServer('srv', 10);
    expect(rows).toHaveLength(1);
  });

  it('handles concurrent enqueues without blocking on sqlite sync path', async () => {
    const jobs = Array.from({ length: 20 }, (_, i) =>
      enqueueAuditWrite({
        record: {
          serverName: 'srv',
          toolName: `tool-${i}`,
          requestTokens: 1,
          responseTokens: 1,
          totalTokens: 2,
          durationMs: 1,
          timestamp: new Date().toISOString(),
        },
      }),
    );
    expect(jobs.every(Boolean)).toBe(true);
    await flushAuditWriteQueue();
    const rows = await db.getCallRecordsForServer('srv', 50);
    expect(rows.length).toBe(20);
  });
});
