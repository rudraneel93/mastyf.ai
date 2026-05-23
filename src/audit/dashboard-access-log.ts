/**
 * SOC2-style dashboard API access logging (per-tenant JSONL).
 */
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ensureTenantAuditDir,
  resolveTenantAccessLogJsonl,
  resolveTenantAuditDir,
  resolveTenantSessionAuditJsonl,
} from './tenant-audit-paths.js';

export interface DashboardAccessEntry {
  timestamp: string;
  userId: string;
  tenantId: string;
  method: string;
  /** API path (SOC2 / ISO 27001 access audit). */
  path: string;
  /** Alias for `path` — compliance exports expect `endpoint`. */
  endpoint: string;
  status: number;
  ip: string;
}

export interface SessionRotateEntry {
  timestamp: string;
  event: 'session_rotate';
  tenantId: string;
  oldTokenPrefix: string;
  newTokenPrefix: string;
}

function appendJsonl(path: string, record: unknown): void {
  appendFileSync(path, `${JSON.stringify(record)}\n`, { flag: 'a' });
}

export function appendDashboardAccessLog(
  entry: Omit<DashboardAccessEntry, 'timestamp' | 'endpoint'> & { endpoint?: string },
): void {
  ensureTenantAuditDir(entry.tenantId);
  const endpoint = entry.endpoint ?? entry.path;
  const record = {
    ...entry,
    endpoint,
    path: entry.path ?? endpoint,
    timestamp: new Date().toISOString(),
  };
  appendJsonl(resolveTenantAccessLogJsonl(entry.tenantId), record);
  void import('../utils/audit-hash-chain.js').then(({ appendSiemChainedEvent }) => {
    appendSiemChainedEvent('dashboard_access', record as unknown as Record<string, unknown>);
  });
}

export function appendSessionRotateAudit(entry: {
  tenantId: string;
  oldToken: string;
  newToken: string;
}): void {
  ensureTenantAuditDir(entry.tenantId);
  appendJsonl(resolveTenantSessionAuditJsonl(entry.tenantId), {
    event: 'session_rotate',
    timestamp: new Date().toISOString(),
    tenantId: entry.tenantId,
    oldTokenPrefix: entry.oldToken.slice(0, 12),
    newTokenPrefix: entry.newToken.slice(0, 12),
  } satisfies SessionRotateEntry);
}

export function readDashboardAccessLog(
  tenantId: string,
  limit = 200,
): DashboardAccessEntry[] {
  const path = resolveTenantAccessLogJsonl(tenantId);
  try {
    if (!existsSync(path)) return [];
    const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as DashboardAccessEntry);
  } catch {
    return [];
  }
}

export function readTenantAuditJsonl(
  tenantId: string,
  fileName: 'policy-audit.jsonl' | 'dashboard-access.jsonl' | 'session-audit.jsonl',
  opts?: { startTime?: string; endTime?: string; limit?: number },
): unknown[] {
  const path = join(resolveTenantAuditDir(tenantId), fileName);
  if (!existsSync(path)) return [];
  const limit = opts?.limit ?? 500;
  const start = opts?.startTime ? Date.parse(opts.startTime) : 0;
  const end = opts?.endTime ? Date.parse(opts.endTime) : Number.MAX_SAFE_INTEGER;
  try {
    const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
    const rows: unknown[] = [];
    for (const line of lines) {
      const row = JSON.parse(line) as { timestamp?: string };
      const ts = row.timestamp ? Date.parse(row.timestamp) : 0;
      if (ts >= start && ts <= end) rows.push(row);
    }
    return rows.slice(-limit);
  } catch {
    return [];
  }
}
