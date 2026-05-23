/**
 * Executive summary rollup for enterprise dashboard overview.
 */
import type { IDatabase } from '../database/database-interface.js';
import {
  getAllActiveServerNames,
  loadAllCallRecords,
  summarizeRecords,
} from './db-aggregate.js';
import { computeBurnRatePerHour, computeProjectedMonthly } from './cost-metrics.js';
import { parseCostBudgetUsd } from './dashboard-live-data.js';

export type ExecutiveSummary = {
  timestamp: string;
  totalRequests: number;
  blockedRequests: number;
  passedRequests: number;
  passRatePct: number;
  blockRatePct: number;
  totalCostUsd: number;
  burnRatePerHour: number;
  projectedMonthlyUsd: number;
  avgLatencyMs: number;
  activeServers: number;
  budgetUsd: number | null;
  budgetUtilizationPct: number | null;
  runwayDays: number | null;
  topServersByCost: Array<{ server: string; costUsd: number; calls: number }>;
  topToolsByCalls: Array<{ tool: string; calls: number }>;
};

export async function buildExecutiveSummary(
  db: IDatabase,
  tenantId: string | undefined,
): Promise<ExecutiveSummary> {
  const srvs = await getAllActiveServerNames(db, tenantId);
  const records = await loadAllCallRecords(db, srvs, tenantId);
  const sum = summarizeRecords(records);
  const passRatePct = sum.total > 0 ? (sum.passed / sum.total) * 100 : 0;
  const burnRatePerHour = computeBurnRatePerHour(sum.costUsd, records);
  const projectedMonthlyUsd = computeProjectedMonthly(sum.costUsd, records);
  const budgetUsd = parseCostBudgetUsd();
  const budgetUtilizationPct =
    budgetUsd != null && budgetUsd > 0 ? (sum.costUsd / budgetUsd) * 100 : null;
  const runwayDays =
    burnRatePerHour > 0 && budgetUsd != null
      ? Math.max(0, (budgetUsd - sum.costUsd) / (burnRatePerHour * 24))
      : null;

  const byServer = new Map<string, { costUsd: number; calls: number }>();
  const byTool = new Map<string, number>();
  for (const r of records) {
    const srv = r.serverName || 'unknown';
    const cur = byServer.get(srv) || { costUsd: 0, calls: 0 };
    cur.calls++;
    cur.costUsd += Number(r.costUsd) || 0;
    byServer.set(srv, cur);
    const tool = r.toolName || 'unknown';
    byTool.set(tool, (byTool.get(tool) || 0) + 1);
  }

  const topServersByCost = [...byServer.entries()]
    .map(([server, v]) => ({ server, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 8);

  const topToolsByCalls = [...byTool.entries()]
    .map(([tool, calls]) => ({ tool, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  return {
    timestamp: new Date().toISOString(),
    totalRequests: sum.total,
    blockedRequests: sum.blocked,
    passedRequests: sum.passed,
    passRatePct: Math.round(passRatePct * 10) / 10,
    blockRatePct: Math.round((100 - passRatePct) * 10) / 10,
    totalCostUsd: sum.costUsd,
    burnRatePerHour: Math.round(burnRatePerHour * 1_000_000) / 1_000_000,
    projectedMonthlyUsd: Math.round(projectedMonthlyUsd * 100) / 100,
    avgLatencyMs: sum.total > 0 ? Math.round(sum.totalLatency / sum.total) : 0,
    activeServers: srvs.length,
    budgetUsd,
    budgetUtilizationPct:
      budgetUtilizationPct != null ? Math.round(budgetUtilizationPct * 10) / 10 : null,
    runwayDays: runwayDays != null ? Math.round(runwayDays * 10) / 10 : null,
    topServersByCost,
    topToolsByCalls,
  };
}
