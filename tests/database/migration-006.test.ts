import { describe, it, expect } from 'vitest';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('migration 006 query indexes', () => {
  it('creates tenant/server timestamp indexes on sqlite', () => {
    const db = new HistoryDatabase(':memory:');
    const indexes = (db as unknown as { db: { prepare: (s: string) => { all: () => unknown[] } } }).db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%_ts' ORDER BY name`,
      )
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names).toContain('idx_call_records_tenant_ts');
    expect(names).toContain('idx_call_records_server_ts');
    expect(names).toContain('idx_cost_records_tenant_ts');
    expect(names).toContain('idx_health_checks_server_ts');
  });
});
