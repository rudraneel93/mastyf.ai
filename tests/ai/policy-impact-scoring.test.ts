import { describe, expect, it } from 'vitest';
import { scorePolicyImpact } from '../../src/ai/policy-impact-scoring.js';

describe('policy impact scoring', () => {
  it('recommends promote for strong low-risk signals', () => {
    const score = scorePolicyImpact({
      confidence: 0.95,
      replayCoverage: 0.99,
      predictedFalsePositiveDelta: 0.001,
      predictedBypassDelta: 0,
      blastRadiusPercent: 0.02,
      rollbackConfidence: 0.98,
    });
    expect(score.recommendation).toBe('promote');
    expect(score.overall).toBeGreaterThan(0.7);
  });

  it('recommends hold for risky proposals', () => {
    const score = scorePolicyImpact({
      confidence: 0.5,
      replayCoverage: 0.6,
      predictedFalsePositiveDelta: 0.08,
      predictedBypassDelta: 0.03,
      blastRadiusPercent: 0.4,
      rollbackConfidence: 0.6,
    });
    expect(score.recommendation).toBe('hold');
  });
});
