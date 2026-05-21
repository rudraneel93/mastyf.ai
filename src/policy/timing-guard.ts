/**
 * Timing side-channel mitigation — blocks timing oracle probes in tool arguments.
 */
import { LRUCache } from 'lru-cache';
import type { CallContext, PolicyDecision } from './policy-types.js';
import { walkStringLeaves } from './arg-leaf-walker.js';
import { deobfuscateRecursive } from '../utils/payload-normalizer.js';

const TIMING_PROBE_PATTERNS: RegExp[] = [
  /\b(?:sleep|benchmark|pg_sleep|waitfor\s+delay|dbms_lock\.sleep)\s*\(/i,
  /\bif\s*\(\s*(?:ascii|ord|substring|substr)\s*\(/i,
  /\b(?:case\s+when|elt\s*\()\s+.*\b(?:sleep|benchmark|waitfor)/i,
  /\b(?:timing|time[- ]?based)\s+(?:attack|oracle|injection)/i,
  /\b(?:measure|detect)\s+(?:response\s+)?time\s+(?:of|for)\s+(?:user|login|password)/i,
  /\b(?:valid|invalid)\s+username\b.*\b(?:timing|delay|sleep)/i,
  /\busername\s+exists\b.*\b(?:time|delay|benchmark)/i,
];

const PROBE_WINDOW_MS = 60_000;
const MAX_TIMING_PROBES_PER_SESSION = parseInt(
  process.env['MCP_GUARDIAN_MAX_TIMING_PROBES_PER_MIN'] ?? '8',
  10,
);

const probeCounters = new LRUCache<string, { count: number; resetAt: number }>({
  max: 20_000,
  ttl: PROBE_WINDOW_MS,
});

function probeSessionKey(ctx: CallContext): string {
  const tenant = ctx.tenantId || process.env['GUARDIAN_TENANT_ID'] || 'default';
  const sub = ctx.agentIdentity?.sub || ctx.agentIdentity?.clientId || 'anon';
  return `timing:${tenant}:${ctx.serverName}:${sub}`;
}

function blobLooksLikeTimingProbe(blob: string): boolean {
  return TIMING_PROBE_PATTERNS.some((p) => p.test(blob));
}

export function resetTimingProbeCounters(): void {
  probeCounters.clear();
}

export function evaluateTimingGuard(ctx: CallContext): PolicyDecision | null {
  const args = ctx.arguments ?? {};
  const blob = walkStringLeaves(args)
    .map((l) => deobfuscateRecursive(l.value))
    .join('\n');

  if (!blob.trim()) return null;

  if (!blobLooksLikeTimingProbe(blob)) return null;

  const key = probeSessionKey(ctx);
  const now = Date.now();
  let counter = probeCounters.get(key);
  if (!counter || now > counter.resetAt) {
    counter = { count: 1, resetAt: now + PROBE_WINDOW_MS };
  } else {
    counter.count++;
  }
  probeCounters.set(key, counter);

  if (counter.count > MAX_TIMING_PROBES_PER_SESSION) {
    return {
      action: 'block',
      rule: 'timing-probe-rate-limit',
      reason: `Timing oracle probe rate exceeded (${counter.count}/${MAX_TIMING_PROBES_PER_SESSION} per minute)`,
    };
  }

  return {
    action: 'block',
    rule: 'timing-side-channel-guard',
    reason: 'Timing-based side-channel probe pattern in tool arguments',
  };
}
