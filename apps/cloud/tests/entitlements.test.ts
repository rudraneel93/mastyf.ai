import { describe, expect, it } from 'vitest';
import { allLicensedFeatures, hasLicensedFeature, LICENSED_FEATURES } from '../lib/entitlements';

describe('entitlements', () => {
  it('exposes all features without gating', () => {
    const features = allLicensedFeatures();
    expect(features).toEqual([...LICENSED_FEATURES]);
    expect(hasLicensedFeature(features, 'swarm')).toBe(true);
    expect(hasLicensedFeature(features, 'dashboard')).toBe(true);
  });
});
