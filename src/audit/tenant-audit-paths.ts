/**
 * Per-tenant audit file paths under ~/.mcp-guardian/tenants/{tenantId}/
 */
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { validateTenantId, DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';

export function guardianHomeDir(): string {
  return process.env['MCP_GUARDIAN_HOME'] || join(homedir(), '.mcp-guardian');
}

export function resolveTenantAuditDir(tenantId?: string): string {
  const tid = validateTenantId(tenantId || process.env['GUARDIAN_TENANT_ID'] || DEFAULT_TENANT_ID);
  return join(guardianHomeDir(), 'tenants', tid);
}

export function ensureTenantAuditDir(tenantId?: string): string {
  const dir = resolveTenantAuditDir(tenantId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveTenantPolicyAuditJsonl(tenantId?: string): string {
  return join(ensureTenantAuditDir(tenantId), 'policy-audit.jsonl');
}

export function resolveTenantAccessLogJsonl(tenantId?: string): string {
  return join(ensureTenantAuditDir(tenantId), 'dashboard-access.jsonl');
}

export function resolveTenantSessionAuditJsonl(tenantId?: string): string {
  return join(ensureTenantAuditDir(tenantId), 'session-audit.jsonl');
}
