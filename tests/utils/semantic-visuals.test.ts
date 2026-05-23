import { describe, it, expect } from 'vitest';
import { buildSemanticVisualsFromRecords } from '../../src/utils/semantic-visuals.js';

describe('buildSemanticVisualsFromRecords', () => {
  it('aggregates live semantic audit records', () => {
    const slice = buildSemanticVisualsFromRecords([
      {
        id: '1',
        tenantId: 'default',
        requestId: 1,
        serverName: 'fs',
        toolName: 'read_file',
        syncDecision: 'pass',
        semanticAudit: {
          suspicious: true,
          confidence: 0.82,
          categories: ['injection'],
          reasoning: 'test',
        },
        timestamp: new Date().toISOString(),
        label: 'true_positive',
      },
    ]);
    expect(slice.hasData).toBe(true);
    expect(slice.totals.flagged).toBe(1);
    expect(slice.labelMix[0]?.label).toBe('true_positive');
  });
});
