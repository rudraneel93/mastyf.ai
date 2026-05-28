import { describe, expect, it } from 'vitest';
import { buildFederatedShareRecords } from '../../src/utils/federated-threat-intel-v2.js';

describe('federated threat intel v2', () => {
  it('ranks records with compatibility and decay weights', () => {
    const rows = buildFederatedShareRecords(
      [
        {
          signatureId: 'sig-a',
          rule: 'semantic-prompt-injection',
          tool: 'search',
          category: 'prompt-injection',
          argShapeHash: 'abc',
          instanceCount: 2,
          eventCount: 5,
          lastSeen: new Date().toISOString(),
        },
      ],
      {
        'sig-a': {
          sourceRegion: 'us-east-1',
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          evidenceCount: 5,
          confidence: 0.9,
        },
      },
      {
        region: 'us-east-1',
        toolUsageSet: new Set(['search']),
        categoryUsageSet: new Set(['prompt-injection']),
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.finalWeight).toBeGreaterThan(0.5);
  });
});
