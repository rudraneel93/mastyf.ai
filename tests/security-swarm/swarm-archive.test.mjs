import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { archiveSwarmArtifacts, listArchiveRuns } from '../../security-swarm/lib/archive-artifacts.mjs';

describe('security-swarm archive artifacts', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'swarm-archive-'));
    writeFileSync(join(dir, 'latest.json'), '{"ok":true}\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('archives existing artifacts with timestamp folder', () => {
    const result = archiveSwarmArtifacts(dir);
    expect(result.archived).toBeGreaterThan(0);
    expect(existsSync(join(result.destDir, 'latest.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(result.destDir, 'latest.json'), 'utf8')).ok).toBe(true);
    const runs = listArchiveRuns(dir);
    expect(runs.length).toBeGreaterThan(0);
  });
});
