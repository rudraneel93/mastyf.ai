import { describe, expect, it, vi } from 'vitest';
import type { StoredSemanticAudit } from '../../src/ai/semantic-audit-store.js';

vi.mock('../../src/ai/semantic-audit-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ai/semantic-audit-store.js')>();
  const records: StoredSemanticAudit[] = [
    {
      id: 'cf-1',
      tenantId: 'default',
      requestId: 'r1',
      serverName: 'filesystem',
      toolName: 'read_file',
      syncDecision: { action: 'pass', rule: 'none', reason: '' },
      semanticAudit: { suspicious: false, confidence: 0.3, categories: ['none'], reasoning: '' },
      timestamp: new Date().toISOString(),
      labeled: true,
      label: 'false_positive',
    },
  ];
  return {
    ...actual,
    loadSemanticAuditRecordsAsync: vi.fn(async () => records),
  };
});

describe('policy-counterfactual', () => {
  it('simulates baseline counterfactual report', async () => {
    const { simulatePolicyCounterfactual } = await import('../../src/ai/policy-counterfactual.js');
    const report = await simulatePolicyCounterfactual({ tenantId: 'default', windowDays: 7 });
    expect(report.sampleCount).toBeGreaterThanOrEqual(0);
    expect(report.summary).toBeTruthy();
  });
});
