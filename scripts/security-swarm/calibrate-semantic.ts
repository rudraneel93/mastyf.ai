#!/usr/bin/env npx tsx
/**
 * Swarm calibrator — analyze labeled semantic audit outcomes and recommend thresholds.
 * Reads real persisted records from ~/.mcp-guardian/semantic-audit-outcomes.jsonl
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  loadSemanticAuditRecords,
  type StoredSemanticAudit,
} from '../../src/ai/semantic-audit-store.js';

const OUT_DIR = join(process.cwd(), 'reports', 'security-swarm');
const sinceDays = parseInt(process.env.SWARM_CALIBRATE_DAYS || '7', 10);

function main(): void {
  const records = loadSemanticAuditRecords({ sinceMs: sinceDays * 24 * 60 * 60 * 1000 });
  const labeled = records.filter((r) => r.labeled && r.label);
  const flagged = records.filter((r) => r.semanticAudit?.suspicious);

  const fp = labeled.filter((r) => r.label === 'false_positive').length;
  const tp = labeled.filter((r) => r.label === 'true_positive').length;
  const totalLabeled = labeled.length;

  const confidences = flagged.map((r) => r.semanticAudit.confidence).filter((c) => c > 0);
  const avgConfidence =
    confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  const currentMin = parseFloat(process.env.GUARDIAN_SEMANTIC_MIN_CONFIDENCE || '0.6');
  let recommendedMin = currentMin;
  if (totalLabeled >= 10) {
    const fpRate = fp / totalLabeled;
    if (fpRate > 0.2) recommendedMin = Math.min(0.95, currentMin + 0.05);
    if (fpRate < 0.05 && tp > fp) recommendedMin = Math.max(0.5, currentMin - 0.03);
  }

  const report = {
    timestamp: new Date().toISOString(),
    windowDays: sinceDays,
    totals: {
      records: records.length,
      flagged: flagged.length,
      labeled: totalLabeled,
      truePositive: tp,
      falsePositive: fp,
    },
    metrics: {
      avgFlagConfidence: Math.round(avgConfidence * 1000) / 1000,
      labeledFpRate: totalLabeled > 0 ? Math.round((fp / totalLabeled) * 1000) / 1000 : null,
    },
    thresholds: {
      current: {
        GUARDIAN_SEMANTIC_MIN_CONFIDENCE: currentMin,
      },
      recommended: {
        GUARDIAN_SEMANTIC_MIN_CONFIDENCE: Math.round(recommendedMin * 1000) / 1000,
      },
      note: 'Apply manually or via tenant config; auto-apply requires quorum (GUARDIAN_AI_AUTO_APPLY stays false in prod).',
    },
    profile:
      totalLabeled >= 10 && fp / totalLabeled > 0.15
        ? 'high-paranoia'
        : flagged.length > records.length * 0.1
          ? 'hybrid'
          : 'sync-only',
    sampleFlagged: flagged.slice(-5).map(summarize),
    sampleLabeled: labeled.slice(-5).map(summarize),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'calibration.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('Semantic calibration report');
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(`Recommended GUARDIAN_SEMANTIC_MIN_CONFIDENCE: ${report.thresholds.recommended.GUARDIAN_SEMANTIC_MIN_CONFIDENCE}`);
  console.log(`Recommended profile: ${report.profile}`);
  console.log(`Written: ${outPath}`);
}

function summarize(r: StoredSemanticAudit) {
  return {
    id: r.id,
    toolName: r.toolName,
    confidence: r.semanticAudit?.confidence,
    label: r.label,
    categories: r.semanticAudit?.categories,
  };
}

main();
