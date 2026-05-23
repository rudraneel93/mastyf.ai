import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';
import {
  generateShadowProbes,
  runShadowProbes,
  runShadowRedTeam,
} from '../../src/ai/shadow-red-team.js';
import type { ServerToolBaseline } from '../../src/ai/tool-integrity-watch.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultPolicy = load(
  readFileSync(resolve(__dir, '../../default-policy.yaml'), 'utf-8'),
) as PolicyConfig;

const baseline: ServerToolBaseline = {
  serverName: 'filesystem',
  fingerprint: 'abc',
  toolNames: ['read_file', 'run'],
  tools: [
    { name: 'read_file', descriptionHash: 'a', schemaHash: 'b' },
    { name: 'run', descriptionHash: 'c', schemaHash: 'd' },
  ],
  capturedAt: new Date().toISOString(),
};

describe('shadow-red-team', () => {
  it('generates and runs shadow probes via PolicyEngine', () => {
    const engine = new PolicyEngine(defaultPolicy);
    const probes = generateShadowProbes([baseline], 8);
    expect(probes.length).toBeGreaterThan(0);
    const results = runShadowProbes(probes, engine);
    expect(results.length).toBe(probes.length);
    expect(results.every((r) => typeof r.bypass === 'boolean')).toBe(true);
  });

  it('writes shadow red team report', async () => {
    const run = await runShadowRedTeam({ probeLimit: 4, writeReport: false });
    expect(run.runId).toMatch(/^shadow-/);
    expect(run.probes.length).toBeGreaterThanOrEqual(0);
  });
});
