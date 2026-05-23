/**
 * Registers self-hosted Guardian instances with MCP Guardian Cloud (heartbeat).
 */
import { getGuardianRegion } from '../utils/region.js';
import { Logger } from '../utils/logger.js';

export type HeartbeatMetrics = {
  totalRequests?: number;
  blockedRequests?: number;
  totalCostUsd?: number;
};

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function controlPlaneUrl(): string | null {
  const url = process.env['GUARDIAN_CONTROL_PLANE_URL']?.replace(/\/$/, '');
  return url || null;
}

function cloudApiKey(): string | null {
  return process.env['GUARDIAN_CLOUD_API_KEY']?.trim()
    || process.env['CONTROL_PLANE_API_KEY']?.trim()
    || null;
}

export function isInstanceRegistryEnabled(): boolean {
  return Boolean(controlPlaneUrl() && cloudApiKey());
}

export async function sendInstanceHeartbeat(metrics?: HeartbeatMetrics): Promise<boolean> {
  const base = controlPlaneUrl();
  const apiKey = cloudApiKey();
  if (!base || !apiKey) return false;

  const payload = {
    instanceId: process.env['GUARDIAN_INSTANCE_ID'] || `guardian-${process.pid}`,
    instanceName: process.env['GUARDIAN_INSTANCE_NAME'] || process.env['HOSTNAME'] || 'guardian',
    region: getGuardianRegion(),
    version: process.env.npm_package_version || 'unknown',
    hostname: process.env['HOSTNAME'] || 'unknown',
    metrics: metrics || {},
  };

  try {
    const res = await fetch(`${base}/api/v1/instances/heartbeat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      Logger.debug(`[instance-registry] heartbeat failed (${res.status}): ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.debug(`[instance-registry] heartbeat error: ${msg}`);
    return false;
  }
}

export function startInstanceRegistry(metricsProvider?: () => Promise<HeartbeatMetrics>): void {
  if (heartbeatTimer || !isInstanceRegistryEnabled()) return;
  const intervalMs = parseInt(process.env['GUARDIAN_HEARTBEAT_INTERVAL_MS'] || '60000', 10);

  const tick = () => {
    void (async () => {
      const metrics = metricsProvider ? await metricsProvider().catch(() => ({})) : {};
      await sendInstanceHeartbeat(metrics);
    })();
  };

  tick();
  heartbeatTimer = setInterval(tick, intervalMs);
  Logger.info(`[instance-registry] Cloud heartbeat started (interval=${intervalMs}ms)`);
}

export function stopInstanceRegistry(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
