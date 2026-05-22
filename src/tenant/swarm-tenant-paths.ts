/**
 * Per-tenant security-swarm artifact directories.
 * Legacy global path: reports/security-swarm (default tenant reads when present).
 */
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_TENANT_ID, validateTenantId } from './resolve-tenant.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const LEGACY_SWARM_DIR = join(REPO_ROOT, 'reports', 'security-swarm');

/** Writable/read path for a tenant's swarm artifacts. */
export function resolveTenantSwarmDir(tenantId: string): string {
  const tid = validateTenantId(tenantId);
  return join(REPO_ROOT, 'reports', 'tenants', tid, 'security-swarm');
}

/** Resolve dir for reads: tenant dir if it has artifacts, else legacy for default only. */
export function getEffectiveSwarmDir(tenantId: string): string {
  const tid = validateTenantId(tenantId);
  const tenantDir = resolveTenantSwarmDir(tid);
  const hasTenantArtifacts =
    existsSync(join(tenantDir, 'job.json'))
    || existsSync(join(tenantDir, 'latest.json'))
    || existsSync(join(tenantDir, 'visuals-data.json'))
    || existsSync(join(tenantDir, 'report.json'));
  if (hasTenantArtifacts) return tenantDir;
  if (tid === DEFAULT_TENANT_ID) {
    const hasLegacy =
      existsSync(join(LEGACY_SWARM_DIR, 'job.json'))
      || existsSync(join(LEGACY_SWARM_DIR, 'latest.json'))
      || existsSync(join(LEGACY_SWARM_DIR, 'visuals-data.json'));
    if (hasLegacy) return LEGACY_SWARM_DIR;
  }
  return tenantDir;
}

export function resolveTenantPolicyAuditPath(tenantId: string): string {
  const tid = validateTenantId(tenantId);
  return join(REPO_ROOT, 'reports', 'tenants', tid, 'policy-audit.jsonl');
}

export { REPO_ROOT };
