import { describe, expect, it, beforeEach, vi } from 'vitest';
import { hashProLicenseKey } from '../lib/pro-license-keys';

vi.mock('@/lib/pro-license-keys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/pro-license-keys')>();
  return {
    ...actual,
    findProLicenseByPlaintext: vi.fn().mockResolvedValue(null),
  };
});

import { GET } from '../app/api/v1/license/route';

describe('GET /api/v1/license', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-license-api-secret';
    delete process.env.DATABASE_URL;
  });

  it('rejects missing bearer', async () => {
    const res = await GET(new Request('http://localhost/api/v1/license'));
    expect(res.status).toBe(401);
  });

  it('rejects unknown pro license key without DATABASE_URL', async () => {
    const res = await GET(
      new Request('http://localhost/api/v1/license', {
        headers: { Authorization: 'Bearer unknown-ls-key-12345' },
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.licensed).toBe(false);
  });

  it('hashProLicenseKey is deterministic', () => {
    expect(hashProLicenseKey('abc')).toBe(hashProLicenseKey('abc'));
    expect(hashProLicenseKey('abc')).not.toBe(hashProLicenseKey('xyz'));
  });
});
