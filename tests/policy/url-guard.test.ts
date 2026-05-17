import { describe, it, expect } from 'vitest';
import { evaluateUrlGuard, isDangerousUrl } from '../../src/policy/url-guard.js';

describe('url-guard', () => {
  it('blocks metadata IP', () => {
    expect(isDangerousUrl('http://169.254.169.254/').block).toBe(true);
  });

  it('blocks decimal localhost', () => {
    expect(isDangerousUrl('http://2130706433/').block).toBe(true);
  });

  it('blocks file scheme', () => {
    expect(isDangerousUrl('file:///etc/passwd').block).toBe(true);
  });

  it('allows public https URL', () => {
    expect(evaluateUrlGuard(['https://example.com/path']).block).toBe(false);
  });
});
