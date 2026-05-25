/**
 * Unified Autopilot learning event log (tenant swarm dir).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { resolveTenantSwarmDir } from '../tenant/swarm-tenant-paths.js';
import { validateTenantId, DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';

export type LearningEventType =
  | 'semantic_tp'
  | 'block_learning'
  | 'threat_research_write'
  | 'suggestion_queued'
  | 'threat_lab_triggered'
  | 'digest_generated';

export type LearningEvent = {
  timestamp: string;
  type: LearningEventType;
  detail: string;
  fingerprint?: string;
  confidence?: number;
};

function eventsPath(tenantId?: string): string {
  const tid = validateTenantId(tenantId || DEFAULT_TENANT_ID);
  return join(resolveTenantSwarmDir(tid), 'learning-events.jsonl');
}

export function appendLearningEvent(
  event: Omit<LearningEvent, 'timestamp'> & { timestamp?: string },
  tenantId?: string,
): void {
  const path = eventsPath(tenantId);
  mkdirSync(dirname(path), { recursive: true });
  const line: LearningEvent = {
    timestamp: event.timestamp || new Date().toISOString(),
    type: event.type,
    detail: event.detail,
    fingerprint: event.fingerprint,
    confidence: event.confidence,
  };
  appendFileSync(path, JSON.stringify(line) + '\n', 'utf-8');
}

export function readRecentLearningEvents(
  tenantId?: string,
  limit = 50,
): LearningEvent[] {
  const path = eventsPath(tenantId);
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
    const out: LearningEvent[] = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try {
        out.push(JSON.parse(lines[i]!) as LearningEvent);
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function countLearningEventsSince(
  type: LearningEventType,
  sinceMs: number,
  tenantId?: string,
): number {
  const cutoff = Date.now() - sinceMs;
  return readRecentLearningEvents(tenantId, 500).filter(
    (e) => e.type === type && Date.parse(e.timestamp) >= cutoff,
  ).length;
}
