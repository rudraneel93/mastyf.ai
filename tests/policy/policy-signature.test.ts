import { describe, expect, it } from 'vitest';
import { signPolicyYaml, validateSignedPolicyYaml } from '../../src/policy/policy-signature.js';

describe('policy-signature', () => {
  it('accepts valid signed policy', () => {
    process.env.GUARDIAN_POLICY_SIGNING_KEY = 'test-secret';
    process.env.GUARDIAN_POLICY_TRUSTED_ISSUERS = 'guardian-admin';
    const yaml = "version: '1.0'\npolicy:\n  mode: block\n  rules: []\n";
    const env = signPolicyYaml(yaml, {
      issuer: 'guardian-admin',
      keyId: 'default',
      issuedAt: '2026-05-28T00:00:00.000Z',
    });
    const check = validateSignedPolicyYaml(yaml, env);
    expect(check.ok).toBe(true);
  });

  it('rejects missing signature when required', () => {
    process.env.GUARDIAN_REQUIRE_SIGNED_POLICY = 'true';
    const check = validateSignedPolicyYaml("version: '1.0'\n", undefined);
    expect(check.ok).toBe(false);
    process.env.GUARDIAN_REQUIRE_SIGNED_POLICY = 'false';
  });
});
