/**
 * Persist async semantic audit outcomes for swarm calibrator and dashboard labels.
 * File-backed JSONL under ~/.mcp-guardian (no fabricated data).
 */
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { homedir } from 'os';
import { join } from 'path';
import type { SemanticAuditResult } from './async-semantic-audit.js';
import type { PolicyDecision } from '../policy/policy-types.js';
import { resolveTenantId } from '../tenant/resolve-tenant.js';

export interface StoredSemanticAudit {
  id: string;
  tenantId: string;
  requestId: string | number;
  serverName: string;
  toolName: string;
  syncDecision: PolicyDecision;
  semanticAudit: SemanticAuditResult;
  model?: string;
  durationMs?: number;
  timestamp: string;
  labeled?: boolean;
  label?: 'true_positive' | 'false_positive' | 'ignored';
  labelUserId?: string;
  labelAt?: string;
}

const MAX_RECORDS = parseInt(process.env.GUARDIAN_SEMANTIC_STORE_MAX || '5000', 10);

function storePath(tenantId?: string): string {
  const tid = tenantId || resolveTenantId();
  const base = join(homedir(), '.mcp-guardian', 'tenants', tid);
  if (tid === 'default') {
    return join(homedir(), '.mcp-guardian', 'semantic-audit-outcomes.jsonl');
  }
  return join(base, 'semantic-audit-outcomes.jsonl');
}

export function appendSemanticAuditRecord(record: Omit<StoredSemanticAudit, 'id' | 'tenantId'>): void {
  const tenantId = resolveTenantId();
  const path = storePath(tenantId);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const line: StoredSemanticAudit = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tenantId,
    ...record,
  };
  appendFileSync(path, `${JSON.stringify(line)}\n`, 'utf-8');
  trimStore(path);
}

function trimStore(path: string): void {
  if (!existsSync(path)) return;
  try {
    const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
    if (lines.length <= MAX_RECORDS) return;
    const kept = lines.slice(-MAX_RECORDS);
    writeFileSync(path, `${kept.join('\n')}\n`, 'utf-8');
  } catch {
    /* best-effort */
  }
}

export function loadSemanticAuditRecords(opts?: {
  tenantId?: string;
  sinceMs?: number;
  limit?: number;
}): StoredSemanticAudit[] {
  const path = storePath(opts?.tenantId);
  if (!existsSync(path)) return [];
  const since = opts?.sinceMs ?? 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - since;
  const limit = opts?.limit ?? 2000;
  const out: StoredSemanticAudit[] = [];
  try {
    const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      const rec = JSON.parse(lines[i]) as StoredSemanticAudit;
      if (new Date(rec.timestamp).getTime() >= cutoff) out.push(rec);
    }
  } catch {
    return [];
  }
  return out.reverse();
}

export function labelSemanticAuditRecord(
  id: string,
  label: 'true_positive' | 'false_positive' | 'ignored',
  userId: string,
  tenantId?: string,
): boolean {
  const path = storePath(tenantId);
  if (!existsSync(path)) return false;
  const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map((line) => {
    const rec = JSON.parse(line) as StoredSemanticAudit;
    if (rec.id !== id) return line;
    found = true;
    rec.labeled = true;
    rec.label = label;
    rec.labelUserId = userId;
    rec.labelAt = new Date().toISOString();
    return JSON.stringify(rec);
  });
  if (!found) return false;
  writeFileSync(path, `${updated.join('\n')}\n`, 'utf-8');
  return true;
}
