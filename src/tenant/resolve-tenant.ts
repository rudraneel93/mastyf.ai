export function resolveTenantId(sources?: {
  header?: string | string[] | undefined;
  meta?: unknown;
}): string {
  const header = sources?.header;
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]) return String(header[0]).trim();

  const meta = sources?.meta as Record<string, unknown> | undefined;
  if (meta?.tenantId && typeof meta.tenantId === 'string') return meta.tenantId;

  return process.env['GUARDIAN_TENANT_ID'] || 'default';
}

export function resolveTenantPolicyPath(tenantId: string, baseDir?: string): string {
  const root = baseDir || process.env['GUARDIAN_POLICY_ROOT'] || '.';
  if (tenantId === 'default') {
    return process.env['GUARDIAN_POLICY_PATH'] || `${root}/default-policy.yaml`;
  }
  return `${root}/policies/${tenantId}/policy.yaml`;
}
