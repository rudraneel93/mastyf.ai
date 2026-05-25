import { describe, expect, it } from 'vitest';
import { buildSecurityDashboard } from '../../src/utils/security-dashboard.js';

describe('buildSecurityDashboard', () => {
  it('returns empty-state payload without database', async () => {
    const payload = await buildSecurityDashboard(null, 'default', 1);
    expect(payload.available).toBe(false);
    expect(payload.threats).toEqual([]);
    expect(payload.layers).toHaveLength(4);
  });
});
