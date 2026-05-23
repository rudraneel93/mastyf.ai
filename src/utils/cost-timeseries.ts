/**
 * Cost time-series aggregation for dashboard charts.
 */
import type { IDatabase } from '../database/database-interface.js';
import type { ProxyCallRecord } from '../types.js';
import { getAllActiveServerNames } from './db-aggregate.js';

export type CostGranularity = 'hour' | 'day';

export type CostTimeseriesPoint = {
  bucket: string;
  server: string;
  costUsd: number;
  calls: number;
};

export type CostTimeseriesResult = {
  windowDays: number;
  granularity: CostGranularity;
  series: CostTimeseriesPoint[];
  totalsByServer: Array<{ server: string; costUsd: number; calls: number }>;
};

function bucketKey(ts: number, granularity: CostGranularity): string {
  const d = new Date(ts);
  if (granularity === 'hour') {
    return d.toISOString().slice(0, 13) + ':00:00.000Z';
  }
  return d.toISOString().slice(0, 10);
}

export async function buildCostTimeseries(
  db: IDatabase,
  tenantId: string | undefined,
  windowDays: number,
  granularity: CostGranularity,
): Promise<CostTimeseriesResult> {
  const cutoff = Date.now() - windowDays * 86400000;
  const srvs = await getAllActiveServerNames(db, tenantId);
  const byBucket = new Map<string, CostTimeseriesPoint>();
  const byServer = new Map<string, { costUsd: number; calls: number }>();

  for (const srv of srvs) {
    const recs = await db.getCallRecordsForServer(srv, undefined, tenantId);
    for (const r of recs) {
      const ts = Date.parse(String(r.timestamp || ''));
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const bucket = bucketKey(ts, granularity);
      const key = `${bucket}|${srv}`;
      const cur = byBucket.get(key) || { bucket, server: srv, costUsd: 0, calls: 0 };
      cur.calls++;
      cur.costUsd += Number(r.costUsd) || 0;
      byBucket.set(key, cur);

      const srvCur = byServer.get(srv) || { costUsd: 0, calls: 0 };
      srvCur.calls++;
      srvCur.costUsd += Number(r.costUsd) || 0;
      byServer.set(srv, srvCur);
    }
  }

  const series = [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  const totalsByServer = [...byServer.entries()]
    .map(([server, v]) => ({ server, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return { windowDays, granularity, series, totalsByServer };
}

/** Pivot series into stacked chart rows keyed by bucket. */
export function pivotCostTimeseries(
  series: CostTimeseriesPoint[],
): Array<{ bucket: string; total: number; [server: string]: string | number }> {
  const buckets = new Map<string, Record<string, number>>();
  for (const p of series) {
    const row = buckets.get(p.bucket) || { total: 0 };
    row[p.server] = (row[p.server] || 0) + p.costUsd;
    row.total += p.costUsd;
    buckets.set(p.bucket, row);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, vals]) => ({ bucket: bucket.slice(5, 16), ...vals })) as Array<{
      bucket: string;
      total: number;
      [server: string]: string | number;
    }>;
}

export async function loadAllRecordsInWindow(
  db: IDatabase,
  tenantId: string | undefined,
  windowDays: number,
): Promise<ProxyCallRecord[]> {
  const cutoff = Date.now() - windowDays * 86400000;
  const srvs = await getAllActiveServerNames(db, tenantId);
  const all: ProxyCallRecord[] = [];
  for (const srv of srvs) {
    const recs = await db.getCallRecordsForServer(srv, undefined, tenantId);
    for (const r of recs) {
      const ts = Date.parse(String(r.timestamp || ''));
      if (Number.isFinite(ts) && ts >= cutoff) all.push(r);
    }
  }
  return all;
}
