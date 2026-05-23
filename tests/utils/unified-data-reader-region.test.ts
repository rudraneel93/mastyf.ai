import { describe, it, expect } from 'vitest';
import { UnifiedDataReader } from '../../src/utils/unified-data-reader.js';

describe('UnifiedDataReader region filter', () => {
  it('joins guardian_instances when region param set', async () => {
    let capturedSql = '';
    const fakePool = {
      connect: async () => ({
        query: async (sql: string, params: unknown[]) => {
          capturedSql = sql;
          expect(params).toContain('eu-west-1');
          return { rows: [] };
        },
        release: () => {},
      }),
    };
    const reader = new UnifiedDataReader(fakePool as any);
    await reader.loadCallRecordsInWindow('default', 7, 'eu-west-1');
    expect(capturedSql).toContain('guardian_instances');
    expect(capturedSql).toContain("metadata->>'region'");
  });

  it('omits region join when region not set', async () => {
    let capturedSql = '';
    const fakePool = {
      connect: async () => ({
        query: async (sql: string) => {
          capturedSql = sql;
          return { rows: [] };
        },
        release: () => {},
      }),
    };
    const reader = new UnifiedDataReader(fakePool as any);
    await reader.loadCallRecordsInWindow('default', 7);
    expect(capturedSql).not.toContain('guardian_instances');
  });
});
