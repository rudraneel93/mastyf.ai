import { describe, it, expect } from 'vitest';
import { compilePolicyRegex } from '../../src/policy/regex-compile.js';

describe('compilePolicyRegex', () => {
  it('compiles YAML-escaped .env path pattern', () => {
    const re = compilePolicyRegex('/\\\\.env');
    expect(re.test('secrets/.env')).toBe(true);
    expect(re.test('readme.txt')).toBe(false);
  });
});
