import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDpopRequired, isDpopLegacyBypass } from '../../src/auth/dpop-enforcement.js';

describe('dpop-enforcement block mode', () => {
  const envKeys = ['MASTYF_AI_REQUIRE_DPOP', 'MASTYF_AI_BLOCKING_MODE', 'MASTYF_AI_LEGACY_NO_DPOP'] as const;
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  beforeEach(() => {
    for (const k of envKeys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  it('requires DPoP when policy mode is block', () => {
    expect(isDpopRequired('block')).toBe(true);
    expect(isDpopRequired('audit')).toBe(false);
  });

  it('requires DPoP when MASTYF_AI_BLOCKING_MODE=true', () => {
    process.env['MASTYF_AI_BLOCKING_MODE'] = 'true';
    expect(isDpopRequired('audit')).toBe(true);
  });

  it('honors MASTYF_AI_LEGACY_NO_DPOP bypass', () => {
    process.env['MASTYF_AI_BLOCKING_MODE'] = 'true';
    process.env['MASTYF_AI_LEGACY_NO_DPOP'] = 'true';
    expect(isDpopLegacyBypass()).toBe(true);
    expect(isDpopRequired('block')).toBe(false);
  });
});
