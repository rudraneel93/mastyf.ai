/**
 * Load per-tool call counts for supply-chain blast radius from history DB.
 */
import type { ProxyCallRecord } from '../types.js';

export async function loadToolCallCounts(
  tenantId: string,
  windowDays = 7,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
    if (dbType === 'postgres' && process.env.DATABASE_URL) {
      const { loadPg } = await import('../database/pg-loader.js');
      const { Pool } = await loadPg();
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
      const result = await pool.query(
        `SELECT server_name, tool_name, COUNT(*)::int AS c
         FROM call_records
         WHERE tenant_id = $1 AND timestamp >= $2
         GROUP BY server_name, tool_name`,
        [tenantId, since],
      );
      await pool.end();
      for (const row of result.rows as Array<{ server_name: string; tool_name: string; c: number }>) {
        counts[`${row.server_name}:${row.tool_name}`] = row.c;
      }
      return counts;
    }
    const { HistoryDatabase } = await import('../database/history-db.js');
    const db = new HistoryDatabase();
    const servers = await db.getDistinctActiveServers(tenantId);
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    for (const server of servers) {
      const records = await db.getCallRecordsForServer(server, 5000, tenantId);
      for (const r of records) {
        if (new Date(r.timestamp).getTime() < cutoff) continue;
        const key = `${r.serverName}:${r.toolName}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  } catch {
    /* empty */
  }
  return counts;
}
