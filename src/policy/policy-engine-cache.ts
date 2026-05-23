/**
 * Reuse compiled PolicyEngine instances across hot-reloads when config hash is unchanged.
 */
import { createHash } from 'crypto';
import { PolicyEngine } from './policy-engine.js';
import type { PolicyConfig } from './policy-types.js';

const cache = new Map<string, PolicyEngine>();
const MAX_CACHE = 32;

function configHash(config: PolicyConfig): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

export function getOrCreatePolicyEngine(config: PolicyConfig): PolicyEngine {
  const key = configHash(config);
  const hit = cache.get(key);
  if (hit) return hit;

  const engine = new PolicyEngine(config);
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, engine);
  return engine;
}

/** @internal */
export function resetPolicyEngineCacheForTests(): void {
  cache.clear();
}
