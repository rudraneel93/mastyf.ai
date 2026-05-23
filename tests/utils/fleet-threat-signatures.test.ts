import { describe, expect, it } from 'vitest';
import {
  buildThreatSignature,
  mergeThreatSignatures,
  aggregateThreatSignaturesFromBlocks,
  detectCrossRegionThreatAlerts,
} from '../../src/utils/fleet-threat-signatures.js';

describe('fleet-threat-signatures', () => {
  it('builds stable anonymized signature IDs', () => {
    const a = buildThreatSignature({ rule: 'path-guard', tool: 'read_file', category: 'traversal' });
    const b = buildThreatSignature({ rule: 'path-guard', tool: 'read_file', category: 'traversal' });
    expect(a.signatureId).toBe(b.signatureId);
    expect(a.signatureId).toHaveLength(16);
  });

  it('merges signature counts', () => {
    const s1 = buildThreatSignature({ rule: 'r1', tool: 't1' }, 2);
    const s2 = buildThreatSignature({ rule: 'r1', tool: 't1' }, 3);
    const merged = mergeThreatSignatures([s1], [s2]);
    expect(merged[0].count).toBe(5);
  });

  it('aggregates blocks without raw payloads', () => {
    const sigs = aggregateThreatSignaturesFromBlocks(
      [
        { rule: 'semantic-flag', tool: 'run', category: 'injection', argKeys: ['command'] },
        { rule: 'semantic-flag', tool: 'run', category: 'injection', argKeys: ['command'] },
      ],
      'us-east-1',
    );
    expect(sigs.length).toBe(1);
    expect(sigs[0].count).toBe(2);
    expect(sigs[0].region).toBe('us-east-1');
  });

  it('alerts on cross-region signature spread', () => {
    const sig = buildThreatSignature({ rule: 'r', tool: 't' }, 5);
    const byRegion = new Map([
      ['us-east-1', [sig]],
      ['eu-west-1', [sig]],
      ['ap-south-1', [sig]],
    ]);
    const alerts = detectCrossRegionThreatAlerts(byRegion, 3);
    expect(alerts.length).toBe(1);
    expect(alerts[0].regionCount).toBe(3);
  });
});
