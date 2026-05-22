import { describe, expect, it } from 'vitest';
import { cloudSsoFeatures, signCloudSession, verifyCloudSession } from '../lib/license';

describe('cloud SSO helpers', () => {
  it('includes all features for SSO exchange', () => {
    expect(cloudSsoFeatures()).toContain('dashboard');
    expect(cloudSsoFeatures()).toContain('websocket');
  });

  it('signs and verifies cloud session tokens', () => {
    process.env.AUTH_SECRET = 'test-secret-for-license';
    const token = signCloudSession({
      tenantSlug: 'acme',
      identity: 'cloud:acme',
      roles: ['tenant-admin'],
    });
    const payload = verifyCloudSession(token);
    expect(payload?.tenantSlug).toBe('acme');
    expect(payload?.roles).toEqual(['tenant-admin']);
  });
});
