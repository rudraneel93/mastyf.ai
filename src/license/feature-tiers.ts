/**
 * Open-core feature tiers — Community (free on npm) vs Pro (paid license).
 */

import { resolveProCheckoutUrl } from './pro-checkout-url.js';

export const PRO_FEATURES = [
  'dashboard',
  'websocket',
  'swarm',
  'ai',
  'audit',
  'metrics',
  'cost',
  'health',
  'fleet',
  'admin',
  'multi_tenant',
  'semantic_async',
  'policy', // cloud policy sync via control plane
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

const PRO_FEATURE_SET = new Set<string>(PRO_FEATURES);

/** Community tier — always available without a license. */
export const COMMUNITY_FEATURES = ['proxy', 'cli', 'policy_local'] as const;

export function isOpenCoreEnabled(): boolean {
  return process.env['GUARDIAN_OPEN_CORE'] !== 'false';
}

export function isProFeature(feature: string): boolean {
  return PRO_FEATURE_SET.has(feature);
}

export function allProFeatureNames(): ProFeature[] {
  return [...PRO_FEATURES];
}

export function getProCheckoutUrl(): string {
  return resolveProCheckoutUrl();
}

export function licenseTier(licensed: boolean): 'community' | 'pro' {
  if (!isOpenCoreEnabled()) return 'pro';
  return licensed ? 'pro' : 'community';
}
