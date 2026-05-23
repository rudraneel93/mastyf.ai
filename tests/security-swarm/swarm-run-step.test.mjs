import { describe, it, expect } from 'vitest';
import { runStep, sanitizeSpawnOutput, STEP_TIMEOUT_MS } from '../../security-swarm/lib/run-step.mjs';

describe('security-swarm run-step', () => {
  it('defines scout timeout', () => {
    expect(STEP_TIMEOUT_MS['scout-audit']).toBe(60_000);
  });

  it('sanitizes secrets from stderr', () => {
    const raw = 'Bearer sk-secret123 api_key=leak password=foo';
    const out = sanitizeSpawnOutput(raw);
    expect(out).not.toContain('sk-secret');
    expect(out).toContain('[REDACTED]');
  });

  it('times out hung subprocess', () => {
    const r = runStep('node', ['-e', 'setInterval(() => {}, 1e9)'], {
      timeoutMs: 500,
      live: false,
    });
    expect(r.timedOut || r.status !== 0).toBe(true);
  }, 10_000);
});
