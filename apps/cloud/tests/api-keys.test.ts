import { describe, expect, it } from 'vitest';
import {
  extractBearerToken,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
} from '../lib/api-keys';

describe('api-keys', () => {
  it('generates gcp_ prefixed keys', () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith('gcp_')).toBe(true);
    expect(verifyApiKey(key.plaintext, key.hash)).toBe(true);
  });

  it('hashes and verifies', () => {
    const hash = hashApiKey('gcp_test_secret_value_here_1234567890');
    expect(verifyApiKey('gcp_test_secret_value_here_1234567890', hash)).toBe(true);
    expect(verifyApiKey('gcp_wrong', hash)).toBe(false);
  });

  it('extracts bearer token', () => {
    expect(extractBearerToken('Bearer gcp_abc123')).toBe('gcp_abc123');
    expect(extractBearerToken('Bearer not_our_prefix')).toBeNull();
  });
});
