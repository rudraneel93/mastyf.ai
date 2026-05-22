/** Features available for every cloud organization (no gating). */
export const LICENSED_FEATURES = [
  'dashboard',
  'websocket',
  'policy',
  'audit',
  'metrics',
  'cost',
  'health',
  'ai',
  'swarm',
  'fleet',
  'admin',
] as const;

export type LicensedFeature = (typeof LICENSED_FEATURES)[number];

export function allLicensedFeatures(): LicensedFeature[] {
  return [...LICENSED_FEATURES];
}

export function hasLicensedFeature(
  features: readonly string[],
  feature: LicensedFeature,
): boolean {
  return features.includes(feature);
}
