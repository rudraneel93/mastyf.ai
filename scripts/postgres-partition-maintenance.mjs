#!/usr/bin/env node
/**
 * Monthly Postgres partition maintenance for call_records (manual maintenance window).
 * Usage: DATABASE_URL=... node scripts/postgres-partition-maintenance.mjs [--dry-run]
 */
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');

function monthBounds(d = new Date()): { start: string; end: string; suffix: string } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  const suffix = `${y}_${String(m + 1).padStart(2, '0')}`;
  return { start, end, suffix };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const { start, end, suffix } = monthBounds();
  const partName = `call_records_${suffix}`;
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${partName}
    PARTITION OF call_records
    FOR VALUES FROM ('${start}') TO ('${end}');
  `;
  if (dryRun) {
    console.log('--dry-run partition DDL:\n', ddl.trim());
    return;
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query(ddl);
    console.log(`Applied partition ${partName} (${start} .. ${end})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('is not partitioned') || msg.includes('does not exist')) {
      console.warn(
        'call_records is not partitioned yet — apply parent DDL from docs/DATABASE_OPERATIONS.md first',
      );
      process.exit(2);
    }
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
