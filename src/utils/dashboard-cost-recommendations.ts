import { CostOptimizer } from '../ai/cost-optimizer.js';
import { CostAuditor } from '../services/cost-auditor.js';
import type { IDatabase } from '../database/database-interface.js';
import type { ProxyCallRecord } from '../types.js';
import { loadAllRecordsInWindow } from './cost-timeseries.js';

export type CostRecommendation = {
  ruleName: string;
  description: string;
  reason: string;
  confidence: number;
  estimatedSavingsUsd: number;
  action: string;
};

export async function buildCostRecommendations(
  db: IDatabase,
  tenantId: string,
  windowDays: number,
): Promise<CostRecommendation[]> {
  const records = await loadAllRecordsInWindow(db, tenantId, windowDays);
  if (records.length === 0) return [];

  const costAuditor = new CostAuditor(undefined, db, undefined, tenantId);
  const optimizer = new CostOptimizer(db as never, costAuditor);
  const patterns = await optimizer.analyzePatterns(records as ProxyCallRecord[], 3, 15);
  const burstMap = await optimizer.detectBurstPatterns(records as ProxyCallRecord[]);
  const suggestions = optimizer.suggestRules(patterns, burstMap);

  return suggestions.slice(0, 12).map((s) => ({
    ruleName: s.rule.name || 'cost-suggestion',
    description: s.rule.description || '',
    reason: s.reason,
    confidence: s.confidence,
    estimatedSavingsUsd: s.estimatedSavings,
    action: String(s.rule.action || 'flag'),
  }));
}
