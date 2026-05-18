import type { IDatabase } from '../database/database-interface.js';
import type { ProxyCallRecord } from '../types.js';
import { getRuntimeModelPricing } from '../services/runtime-model-pricing.js';
import { resolveModelIdForServer } from '../config/llm-config.js';
import * as Metrics from './metrics.js';
import { broadcastDashboardEvent } from './dashboard-events.js';
import { withSqliteBusyRetry } from './sqlite-busy-retry.js';

export async function enrichCallRecord(
  record: ProxyCallRecord,
  msg?: unknown,
  serverEnv?: Record<string, string>,
  serverArgs?: string[],
): Promise<ProxyCallRecord> {
  const pricing = getRuntimeModelPricing();
  const cost = await pricing.computeCostForCall(record.requestTokens, record.responseTokens, msg);
  const fallbackModel = resolveModelIdForServer(record.serverName, serverEnv, serverArgs);
  const model = cost.model || fallbackModel;

  let costUsd = cost.priced ? cost.costUsd : 0;
  let pricingSource = cost.source;

  if (costUsd <= 0 && model && (record.requestTokens + record.responseTokens) > 0) {
    const resolved = await pricing.resolveModelId(model);
    if (resolved) {
      const recomputed = pricing.computeCost(record.requestTokens, record.responseTokens, resolved);
      if (recomputed.priced) {
        costUsd = recomputed.costUsd;
        pricingSource = recomputed.source;
      }
    }
  }

  return {
    ...record,
    model,
    costUsd,
    pricingSource,
  };
}

export async function persistCallRecord(
  db: IDatabase,
  record: ProxyCallRecord,
  msg?: unknown,
  serverEnv?: Record<string, string>,
  serverArgs?: string[],
): Promise<ProxyCallRecord> {
  const enriched = await enrichCallRecord(record, msg, serverEnv, serverArgs);
  await withSqliteBusyRetry(() => db.addCallRecord(enriched));
  broadcastDashboardEvent({
    type: enriched.blocked ? 'policy-block' : 'audit:decision',
    serverName: enriched.serverName,
    payload: {
      toolName: enriched.toolName,
      blocked: !!enriched.blocked,
      blockRule: enriched.blockRule,
      blockReason: enriched.blockReason,
      totalTokens: enriched.totalTokens,
      costUsd: enriched.costUsd,
    },
    timestamp: Date.now(),
  });
  if (enriched.costUsd && enriched.costUsd > 0) {
    const costUsd = enriched.costUsd;
    await withSqliteBusyRetry(() =>
      db.addCostRecord(enriched.serverName, enriched.totalTokens, costUsd),
    );
    Metrics.tokenCostUsd.observe(
      { server_name: enriched.serverName, model: enriched.model || 'unknown' },
      enriched.costUsd,
    );
  }
  return enriched;
}
