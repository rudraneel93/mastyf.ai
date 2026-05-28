import { describe, expect, it } from 'vitest';
import { evaluateAutopilotSafety } from '../../src/ai/autopilot-safety-contract.js';

describe('autopilot safety contract', () => {
  it('blocks unsafe rollout evidence', () => {
    const result = evaluateAutopilotSafety({
      suggestionId: 's-1',
      source: 'baseline',
      stage: 'canary',
      rule: { name: 'r1', action: 'block' },
      evidence: {
        simulationPassed: false,
        replayCoverage: 0.7,
        confidence: 0.4,
        predictedFalsePositiveDelta: 0.07,
        predictedBypassDelta: 0.02,
        blastRadiusPercent: 0.4,
        rollbackConfidence: 0.5,
        canarySizePercent: 0.3,
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('allows rollout when all gates pass', () => {
    const result = evaluateAutopilotSafety({
      suggestionId: 's-2',
      source: 'threat',
      stage: 'canary',
      rule: { name: 'r2', action: 'block' },
      evidence: {
        simulationPassed: true,
        replayCoverage: 0.99,
        confidence: 0.91,
        predictedFalsePositiveDelta: 0.0,
        predictedBypassDelta: 0.0,
        blastRadiusPercent: 0.03,
        rollbackConfidence: 0.99,
        canarySizePercent: 0.05,
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});
