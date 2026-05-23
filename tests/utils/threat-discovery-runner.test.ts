import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  getThreatDiscoveryJobStatus,
  isThreatDiscoveryJobRunning,
  resetThreatDiscoveryRunnerForTests,
} from '../../src/utils/threat-discovery-runner.js';
import { ensureTenantSwarmDir } from '../../src/utils/swarm-artifacts.js';

const TENANT = 'test-threat-runner';

describe('threat-discovery-runner', () => {
  beforeEach(() => {
    resetThreatDiscoveryRunnerForTests();
    ensureTenantSwarmDir(TENANT);
  });

  afterEach(() => {
    resetThreatDiscoveryRunnerForTests();
    for (const kind of ['threat-lab', 'auto-research'] as const) {
      const p = join(
        ensureTenantSwarmDir(TENANT),
        kind === 'threat-lab' ? 'threat-lab-job.json' : 'auto-research-job.json',
      );
      if (existsSync(p)) rmSync(p);
    }
  });

  it('returns idle job status when no job file', () => {
    const st = getThreatDiscoveryJobStatus(TENANT, 'threat-lab');
    expect(st.state).toBe('idle');
    expect(isThreatDiscoveryJobRunning(TENANT, 'threat-lab')).toBe(false);
  });

  it('reads running job from job file', () => {
    const dir = ensureTenantSwarmDir(TENANT);
    writeFileSync(
      join(dir, 'threat-lab-job.json'),
      JSON.stringify({
        jobId: 'test-job',
        state: 'running',
        phase: 'discover',
        phaseLabel: 'Threat Lab discovery',
        progressPct: 50,
        startedAt: new Date().toISOString(),
        pid: process.pid,
      }),
    );
    const st = getThreatDiscoveryJobStatus(TENANT, 'threat-lab');
    expect(st.state).toBe('running');
    expect(st.jobId).toBe('test-job');
  });
});
