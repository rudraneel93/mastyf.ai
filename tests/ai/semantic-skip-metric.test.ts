import { describe, it, expect, beforeEach } from 'vitest';
import { reportSemanticAuditSkipped } from '../../src/ai/semantic-llm-rate-limit.js';
import * as Metrics from '../../src/utils/metrics.js';

describe('semantic skip metric', () => {
  beforeEach(() => {
    reportSemanticAuditSkipped('no_api_key', 'default');
  });

  it('exposes mastyf_ai_semantic_audit_skipped_total', async () => {
    const text = await Metrics.registry.getSingleMetricAsString(
      'mastyf_ai_semantic_audit_skipped_total',
    );
    expect(text).toContain('mastyf_ai_semantic_audit_skipped_total');
    expect(text).toMatch(/no_api_key/);
  });
});
