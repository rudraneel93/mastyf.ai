/**
 * Wire WebSocket data providers to history DB + AI engine for live dashboard push.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WsBroadcaster } from '../dashboard/ws-broadcaster.js';
import {
  getAllActiveServerNames,
  loadAllCallRecords,
  summarizeRecords,
} from './db-aggregate.js';
import { REPO_ROOT } from './security-swarm-runner.js';
import { resolveAiPendingSuggestionsPath } from '../ai/ai-paths.js';
import { getAiEngine } from '../ai/suggestion-engine.js';

let wiredDb: unknown = null;

export function wireDashboardWsProviders(ws: WsBroadcaster | null, historyDb: unknown): void {
  if (!ws || !historyDb) return;
  wiredDb = historyDb;
  const db = historyDb as Parameters<typeof loadAllCallRecords>[0];

  ws.setDataProviders({
    auditTrail: async () => {
      try {
        const srvs = await getAllActiveServerNames(db);
        const records = await loadAllCallRecords(db, srvs);
        const sorted = [...records].sort((a, b) =>
          (b.timestamp || '').localeCompare(a.timestamp || ''),
        );
        return sorted.slice(0, 50).map((r) => ({
          timestamp: r.timestamp,
          server_name: r.serverName,
          tool_name: r.toolName,
          action: r.blocked ? 'block' : 'pass',
          rule: r.blockRule,
          reason: r.blockReason,
          cost_usd: r.costUsd,
        }));
      } catch {
        return [];
      }
    },
    metrics: async () => {
      try {
        const srvs = await getAllActiveServerNames(db);
        const records = await loadAllCallRecords(db, srvs);
        const sum = summarizeRecords(records);
        const avgLatency = sum.total > 0 ? Math.round(sum.totalLatency / sum.total) : 0;
        const passRate = sum.total > 0 ? Math.round((sum.passed / sum.total) * 100) : 100;
        return {
          totalRequests: sum.total,
          blockedRequests: sum.blocked,
          passedRequests: sum.passed,
          totalCost: sum.costUsd,
          avgLatencyMs: avgLatency,
          passRate,
          activeServers: srvs.length,
          burnRatePerHour: sum.total > 0 ? (sum.costUsd / sum.total) * 100 : 0,
          lastUpdated: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    },
    suggestions: () => {
      try {
        const path = resolveAiPendingSuggestionsPath();
        if (existsSync(path)) {
          const body = JSON.parse(readFileSync(path, 'utf-8')) as { suggestions?: unknown[] };
          return body.suggestions || [];
        }
      } catch {
        /* fall through */
      }
      return [];
    },
    aiState: () => {
      try {
        return getAiEngine()?.getSelfImprovement()?.getState() ?? null;
      } catch {
        return null;
      }
    },
    baselines: () => {
      try {
        return getAiEngine()?.getBaselineLearner()?.getAllBaselines() ?? [];
      } catch {
        return [];
      }
    },
    logs: () => {
      const lines: string[] = [];
      const jobLog = join(REPO_ROOT, 'reports', 'security-swarm', 'job.log');
      if (existsSync(jobLog)) {
        const tail = readFileSync(jobLog, 'utf-8').split('\n').filter(Boolean).slice(-40);
        lines.push(...tail.map((l) => `[swarm] ${l}`));
      }
      return lines;
    },
  });
}

export function getWiredDashboardDb(): unknown {
  return wiredDb;
}
