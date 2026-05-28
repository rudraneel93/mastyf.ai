import { describe, expect, it } from 'vitest';
import { buildPartnerSignalFeed, evaluateGuardianCertification } from '../../src/utils/guardian-certified-mcp.js';

describe('guardian certification', () => {
  it('returns deterministic structure even without reports', () => {
    const status = evaluateGuardianCertification('/tmp/non-existent-root');
    expect(typeof status.certified).toBe('boolean');
    expect(['none', 'bronze', 'silver', 'gold']).toContain(status.level);
    expect(Array.isArray(status.checks)).toBe(true);
  });

  it('emits partner signal feed with certification keys', () => {
    const feed = buildPartnerSignalFeed('/tmp/non-existent-root');
    const keys = feed.signals.map((s) => s.key);
    expect(keys).toContain('guardian_certified');
    expect(keys).toContain('guardian_certification_level');
    expect(keys).toContain('guardian_checks_passed');
  });
});
