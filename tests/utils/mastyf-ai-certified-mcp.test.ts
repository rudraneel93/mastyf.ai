import { describe, expect, it } from 'vitest';
import { buildPartnerSignalFeed, evaluateMastyfAiCertification } from '../../src/utils/mastyf-ai-certified-mcp.js';

describe('mastyf-ai certification', () => {
  it('returns deterministic structure even without reports', () => {
    const status = evaluateMastyfAiCertification('/tmp/non-existent-root');
    expect(typeof status.certified).toBe('boolean');
    expect(['none', 'bronze', 'silver', 'gold']).toContain(status.level);
    expect(Array.isArray(status.checks)).toBe(true);
  });

  it('emits partner signal feed with certification keys', () => {
    const feed = buildPartnerSignalFeed('/tmp/non-existent-root');
    const keys = feed.signals.map((s) => s.key);
    expect(keys).toContain('mastyf-ai_certified');
    expect(keys).toContain('mastyf-ai_certification_level');
    expect(keys).toContain('mastyf-ai_checks_passed');
  });
});
