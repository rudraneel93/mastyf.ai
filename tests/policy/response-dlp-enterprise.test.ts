import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  evaluateResponseDlp,
  getResponseDlpMode,
  shouldBlockResponseDlp,
} from '../../src/policy/response-dlp.js';

describe('response DLP enterprise', () => {
  const prev = process.env.GUARDIAN_RESPONSE_DLP_MODE;

  afterEach(() => {
    if (prev) process.env.GUARDIAN_RESPONSE_DLP_MODE = prev;
    else delete process.env.GUARDIAN_RESPONSE_DLP_MODE;
  });

  it('detects expanded PII patterns', () => {
    const r = evaluateResponseDlp('t', 's', 'contact +1-555-123-4567 and IBAN DE89370400440532013000');
    expect(r.findings.some((f) => f.ruleId === 'pii-phone' || f.ruleId === 'pii-iban')).toBe(true);
  });

  it('redact mode scrubs sensitive spans', () => {
    process.env.GUARDIAN_RESPONSE_DLP_MODE = 'redact';
    const body = 'user ssn 123-45-6789 ok';
    const r = evaluateResponseDlp('t', 's', body);
    expect(r.mode).toBe('redact');
    expect(r.redactedBody).toBeDefined();
    expect(r.redactedBody).not.toContain('123-45-6789');
    expect(shouldBlockResponseDlp(r)).toBe(false);
  });

  it('audit mode never blocks', () => {
    process.env.GUARDIAN_RESPONSE_DLP_MODE = 'audit';
    const r = evaluateResponseDlp('t', 's', 'AKIAIOSFODNN7EXAMPLE');
    expect(getResponseDlpMode()).toBe('audit');
    expect(shouldBlockResponseDlp(r)).toBe(false);
  });
});
