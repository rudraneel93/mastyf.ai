export type HeartbeatPayload = {
  instanceId: string;
  instanceName?: string;
  region?: string;
  version?: string;
  hostname?: string;
  metrics?: Record<string, unknown>;
};

export function parseHeartbeatBody(body: unknown): { ok: true; data: HeartbeatPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid JSON body' };
  }
  const row = body as Record<string, unknown>;
  const instanceId = typeof row.instanceId === 'string' ? row.instanceId.trim() : '';
  if (!instanceId) {
    return { ok: false, error: 'instanceId required' };
  }
  return {
    ok: true,
    data: {
      instanceId,
      instanceName: typeof row.instanceName === 'string' ? row.instanceName : undefined,
      region: typeof row.region === 'string' ? row.region : undefined,
      version: typeof row.version === 'string' ? row.version : undefined,
      hostname: typeof row.hostname === 'string' ? row.hostname : undefined,
      metrics:
        row.metrics && typeof row.metrics === 'object' && !Array.isArray(row.metrics)
          ? (row.metrics as Record<string, unknown>)
          : {},
    },
  };
}
