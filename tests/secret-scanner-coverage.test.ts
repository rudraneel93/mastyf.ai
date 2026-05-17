import { describe, it, expect } from 'vitest';
import { getSecretRuleCount, getRules, scanForSecrets } from '../src/scanners/secret-scanner.js';

/** Canonical samples — one per provider category for spot-check coverage. */
const PROVIDER_SAMPLES: Array<{ provider: string; sample: string; ruleIdHint?: string }> = [
  { provider: 'AWS', sample: 'AKIAIOSFODNN7EXAMPLE' },
  { provider: 'GitHub', sample: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890' },
  { provider: 'GitLab', sample: 'glpat-abcdefghijklmnopqrst' },
  { provider: 'OpenAI', sample: 'sk-proj-' + 'A'.repeat(48) },
  { provider: 'Anthropic', sample: 'sk-ant-api03-' + 'x'.repeat(90) + 'AA' },
  { provider: 'Google', sample: 'AIzaSyD-EXAMPLE_KEY_abcdefghijklmnopqrstuv' },
  { provider: 'Azure', sample: 'abc3Q~abcdefghijklmnopqrstuvwxyz1234567890ab' },
  { provider: 'Stripe', sample: 'sk_live_' + '0'.repeat(24) },
  // Built at runtime so push protection does not flag canonical token shapes in git.
  { provider: 'Slack', sample: ['xox', 'b-0000000000-0000000000-FAKEFAKEFAKEFAKEFAKEFAKE'].join('') },
  { provider: 'Discord', sample: ['M0000000000000000000000000', 'FAKE00', '000000000000000000000000000'].join('.') },
  { provider: 'Telegram', sample: '1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawx' },
  { provider: 'SendGrid', sample: 'SG.abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz1234567890abcdefghij' },
  { provider: 'Twilio', sample: 'SK' + 'a'.repeat(32) },
  { provider: 'Database', sample: 'postgresql://admin:secretpass123@db.example.com:5432/mydb' },
  { provider: 'HuggingFace', sample: 'hf_' + 'A'.repeat(34) },
  { provider: 'Groq', sample: 'gsk_' + 'A'.repeat(52) },
  { provider: 'DigitalOcean', sample: 'dop_v1_' + 'a'.repeat(64) },
  { provider: 'Cloudflare', sample: 'v1.0-' + 'a'.repeat(24) + '-' + 'b'.repeat(146) },
  { provider: 'npm', sample: 'npm_' + 'A'.repeat(36) },
  { provider: 'Generic', sample: 'password=supersecret123' },
];

describe('Secret scanner coverage', () => {
  it('ships at least 150 distinct secret detection rules', () => {
    expect(getSecretRuleCount()).toBeGreaterThanOrEqual(150);
    const ids = new Set(getRules().map((r) => r.id));
    expect(ids.size).toBe(getSecretRuleCount());
  });

  it('pre-compiles all rules at module load', () => {
    const rules = getRules();
    expect(rules.length).toBeGreaterThanOrEqual(150);
    for (const rule of rules) {
      expect(rule.regex).toBeInstanceOf(RegExp);
    }
  });

  for (const { provider, sample } of PROVIDER_SAMPLES) {
    it(`detects a canonical ${provider} secret sample`, () => {
      const findings = scanForSecrets(sample, `coverage:${provider}`);
      expect(findings.length).toBeGreaterThan(0);
    });
  }
});
