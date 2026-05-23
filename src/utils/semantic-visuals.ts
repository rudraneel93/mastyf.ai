/**
 * Live semantic audit aggregates for dashboard visuals (no calibration.json).
 */
import type { StoredSemanticAudit } from '../ai/semantic-audit-store.js';

export type SemanticVisualsSlice = {
  hasData: boolean;
  totals: Record<string, number>;
  confidenceBuckets: Array<{ bucket: string; count: number }>;
  labelMix: Array<{ label: string; count: number }>;
  avgFlagConfidence: number;
};

function confidenceBucket(confidence: number): string {
  if (confidence < 0.5) return '0.0-0.5';
  if (confidence < 0.7) return '0.5-0.7';
  if (confidence < 0.85) return '0.7-0.85';
  return '0.85-1.0';
}

export function buildSemanticVisualsFromRecords(records: StoredSemanticAudit[]): SemanticVisualsSlice {
  const confidenceBuckets = new Map<string, number>();
  const labelMix = new Map<string, number>();
  let flagged = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const rec of records) {
    const audit = rec.semanticAudit;
    if (!audit?.suspicious) continue;
    flagged += 1;
    const c = audit.confidence ?? 0;
    confidenceSum += c;
    confidenceCount += 1;
    const bucket = confidenceBucket(c);
    confidenceBuckets.set(bucket, (confidenceBuckets.get(bucket) || 0) + 1);
    const lab = rec.label || 'unlabeled';
    labelMix.set(String(lab), (labelMix.get(String(lab)) || 0) + 1);
  }

  return {
    hasData: records.length > 0,
    totals: {
      records: records.length,
      flagged,
    },
    confidenceBuckets: [...confidenceBuckets.entries()].map(([bucket, count]) => ({ bucket, count })),
    labelMix: [...labelMix.entries()].map(([label, count]) => ({ label, count })),
    avgFlagConfidence:
      confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 1000) / 1000 : 0,
  };
}
