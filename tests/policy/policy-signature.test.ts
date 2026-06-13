import { describe, expect, it } from 'vitest';
import { signPolicyYaml, validateSignedPolicyYaml } from '../../src/policy/policy-signature.js';

describe('policy-signature', () => {
  it('accepts valid signed policy', () => {
    process.env.MASTYF_AI_POLICY_SIGNING_KEY = 'test-secret';
    process.env.MASTYF_AI_POLICY_TRUSTED_ISSUERS = 'mastyf-ai-admin';
    const yaml = "version: '1.0'\npolicy:\n  mode: block\n  rules: []\n";
    const env = signPolicyYaml(yaml, {
      issuer: 'mastyf-ai-admin',
      keyId: 'default',
      issuedAt: '2026-05-28T00:00:00.000Z',
    });
    const check = validateSignedPolicyYaml(yaml, env);
    expect(check.ok).toBe(true);
  });

  it('rejects missing signature when required', () => {
    process.env.MASTYF_AI_REQUIRE_SIGNED_POLICY = 'true';
    const check = validateSignedPolicyYaml("version: '1.0'\n", undefined);
    expect(check.ok).toBe(false);
    process.env.MASTYF_AI_REQUIRE_SIGNED_POLICY = 'false';
  });
});
