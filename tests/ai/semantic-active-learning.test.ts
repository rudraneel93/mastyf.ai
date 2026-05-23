import { describe, expect, it } from 'vitest';
import {
  rankSemanticReviewQueue,
  recommendSemanticThresholds,
  buildActiveLearningReport,
} from '../../src/ai/semantic-active-learning.js';
import type { StoredSemanticAudit } from '../../src/ai/semantic-audit-store.js';

function mockRecord(partial: Partial<StoredSemanticAudit> & { id: string }): StoredSemanticAudit {
  return {
    tenantId: 'default',
    requestId: partial.id,
    serverName: 'test-server',
    toolName: partial.toolName || 'read_file',
    syncDecision: partial.syncDecision || { action: 'pass', rule: 'allow', reason: 'ok' },
    semanticAudit: partial.semanticAudit || {
      suspicious: true,
      confidence: 0.84,
      categories: ['prompt-injection'],
      reasoning: 'test',
    },
    timestamp: partial.timestamp || new Date().toISOString(),
    ...partial,
  };
}

describe('semantic-active-learning', () => {
  it('ranks unlabeled near-threshold records highest', () => {
    const records = [
      mockRecord({
        id: 'a',
        labeled: true,
        label: 'true_positive',
        semanticAudit: { suspicious: true, confidence: 0.95, categories: ['x'], reasoning: 'r' },
      }),
      mockRecord({
        id: 'b',
        semanticAudit: { suspicious: true, confidence: 0.61, categories: ['x'], reasoning: 'r' },
      }),
    ];
    const ranked = rankSemanticReviewQueue(records, { limit: 5 });
    expect(ranked[0].id).toBe('b');
    expect(ranked[0].uncertaintyScore).toBeGreaterThan(0);
    expect(ranked[0].uncertaintyReasons.length).toBeGreaterThan(0);
  });

  it('recommends raising thresholds on high FP rate', () => {
    const records: StoredSemanticAudit[] = [];
    for (let i = 0; i < 12; i++) {
      records.push(
        mockRecord({
          id: `fp-${i}`,
          labeled: true,
          label: 'false_positive',
          semanticAudit: { suspicious: true, confidence: 0.7, categories: ['x'], reasoning: 'r' },
        }),
      );
    }
    const rec = recommendSemanticThresholds(records);
    expect(rec.labeledCount).toBe(12);
    expect(rec.recommendedMinConfidence).toBeGreaterThan(rec.currentMinConfidence);
  });

  it('buildActiveLearningReport returns top 5 review queue', () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      mockRecord({ id: `r-${i}`, toolName: `tool-${i}` }),
    );
    const report = buildActiveLearningReport(records);
    expect(report.reviewQueue.length).toBeLessThanOrEqual(5);
    expect(report.totals.flagged).toBe(8);
  });
});
