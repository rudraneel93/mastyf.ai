/**
 * Dashboard session boundaries for swarm / batch artifacts.
 * Strict live mode hides committed or stale swarm files unless a job started
 * after this dashboard process booted.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_TENANT_ID, validateTenantId } from '../tenant/resolve-tenant.js';
import { LEGACY_SWARM_DIR, resolveTenantSwarmDir } from '../tenant/swarm-tenant-paths.js';

const JOB_FILES = ['job.json', 'threat-lab-job.json', 'auto-research-job.json'] as const;
const ARTIFACT_MTIME_GRACE_MS = 60_000;

/** Set when dashboard-server (or tests) initialize the session clock. */
export let dashboardSessionStartedMs = Date.now();

export function resetDashboardSessionForTests(at?: number): void {
  dashboardSessionStartedMs = at ?? Date.now();
}

/** Default true — set GUARDIAN_DASHBOARD_STRICT_LIVE=false to disable session gating. */
export function isStrictLiveDashboard(): boolean {
  return process.env.GUARDIAN_DASHBOARD_STRICT_LIVE !== 'false';
}

export function isLegacyArtifactsAllowed(): boolean {
  return process.env.GUARDIAN_SWARM_USE_LEGACY_ARTIFACTS === 'true';
}

function parseJobFile(path: string): { startedAtMs: number; state: string } | null {
  if (!existsSync(path)) return null;
  try {
    const job = JSON.parse(readFileSync(path, 'utf-8')) as {
      startedAt?: string;
      state?: string;
    };
    if (!job.startedAt) return null;
    const startedAtMs = Date.parse(job.startedAt);
    if (Number.isNaN(startedAtMs)) return null;
    return { startedAtMs, state: String(job.state ?? 'idle') };
  } catch {
    return null;
  }
}

function tenantJobPaths(tenantId: string): string[] {
  const dir = resolveTenantSwarmDir(validateTenantId(tenantId));
  return JOB_FILES.map((name) => join(dir, name));
}

/** Earliest job start time in this dashboard session, if any. */
export function getSessionJobStartedMs(tenantId: string): number | null {
  let earliest: number | null = null;
  for (const p of tenantJobPaths(tenantId)) {
    const job = parseJobFile(p);
    if (!job || job.startedAtMs < dashboardSessionStartedMs) continue;
    if (earliest == null || job.startedAtMs < earliest) earliest = job.startedAtMs;
  }
  return earliest;
}

export function hasRunningSessionJob(tenantId: string): boolean {
  for (const p of tenantJobPaths(tenantId)) {
    const job = parseJobFile(p);
    if (!job) continue;
    if (job.state === 'running' && job.startedAtMs >= dashboardSessionStartedMs) return true;
  }
  return false;
}

/** True when a swarm / threat-discovery job ran (or is running) this dashboard session. */
export function isSwarmSessionActiveForTenant(tenantId: string): boolean {
  if (!isStrictLiveDashboard()) return true;
  return getSessionJobStartedMs(tenantId) != null || hasRunningSessionJob(tenantId);
}

export function isLegacySwarmPath(filePath: string): boolean {
  return filePath.startsWith(`${LEGACY_SWARM_DIR}/`) || filePath === LEGACY_SWARM_DIR;
}

/**
 * Whether a swarm artifact file may be exposed on the dashboard.
 * Legacy committed dir requires opt-in env AND an active session job.
 */
export function isSwarmArtifactVisibleForSession(
  filePath: string,
  tenantId?: string,
): boolean {
  if (!isStrictLiveDashboard()) return true;

  const tid = validateTenantId(tenantId?.trim() || DEFAULT_TENANT_ID);

  if (isLegacySwarmPath(filePath)) {
    if (!isLegacyArtifactsAllowed()) return false;
  }

  const sessionStart = getSessionJobStartedMs(tid);
  if (sessionStart == null) {
    return hasRunningSessionJob(tid);
  }

  try {
    return statSync(filePath).mtimeMs >= sessionStart - ARTIFACT_MTIME_GRACE_MS;
  } catch {
    return false;
  }
}

export type SwarmDataProvenance = {
  strictLive: boolean;
  sessionActive: boolean;
  legacyAllowed: boolean;
  source: 'session-swarm' | 'legacy-swarm' | 'none';
};

export function swarmDataProvenance(tenantId: string): SwarmDataProvenance {
  const strictLive = isStrictLiveDashboard();
  const sessionActive = isSwarmSessionActiveForTenant(tenantId);
  const legacyAllowed = isLegacyArtifactsAllowed();
  let source: SwarmDataProvenance['source'] = 'none';
  if (sessionActive) source = 'session-swarm';
  else if (legacyAllowed && strictLive) source = 'none';
  else if (!strictLive) source = 'session-swarm';
  return { strictLive, sessionActive, legacyAllowed, source };
}
