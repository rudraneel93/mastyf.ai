/**
 * Per-tenant rate limit for semantic LLM API calls.
 */
import { Counter } from 'prom-client';
import { DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';
import { registry } from '../utils/metrics.js';
import { isRedisConfigured } from '../utils/redis-client.js';
import { getSharedRedisRateLimiter } from '../utils/redis-rate-limiter.js';

const MAX_PER_MIN = parseInt(process.env.GUARDIAN_SEMANTIC_LLM_MAX_PER_MIN || '10', 10);
const WINDOW_MS = 60_000;

const localBuckets = new Map<string, { count: number; resetAt: number }>();

export const semanticAuditSkippedTotal = new Counter({
  name: 'mcp_guardian_semantic_audit_skipped_total',
  help: 'Semantic audit skipped (circuit, rate limit, no API key)',
  labelNames: ['reason', 'tenant_id'],
  registers: [registry],
});

export function reportSemanticAuditSkipped(
  reason: string,
  tenantId?: string,
): void {
  semanticAuditSkippedTotal.inc({
    reason,
    tenant_id: tenantId?.trim() || DEFAULT_TENANT_ID,
  });
}

export async function allowSemanticLlmCall(tenantId?: string): Promise<boolean> {
  const tid = tenantId?.trim() || DEFAULT_TENANT_ID;
  const key = 'semantic-llm';

  if (isRedisConfigured()) {
    try {
      const rl = getSharedRedisRateLimiter();
      const { allowed } = await rl.checkAndIncrement(key, MAX_PER_MIN, WINDOW_MS, tid);
      return allowed;
    } catch {
      /* fall through to local */
    }
  }

  const bucketKey = `${tid}:${key}`;
  const now = Date.now();
  let b = localBuckets.get(bucketKey);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    localBuckets.set(bucketKey, b);
  }
  if (b.count >= MAX_PER_MIN) return false;
  b.count++;
  return true;
}

/** @internal */
export function resetSemanticLlmRateLimitForTests(): void {
  localBuckets.clear();
}
