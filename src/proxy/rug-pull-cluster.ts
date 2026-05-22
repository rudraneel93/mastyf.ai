/**
 * Cluster-aware rug-pull fingerprint registry (Redis when REDIS_URL set).
 */
import { Logger } from '../utils/logger.js';

const localAlerts = new Map<string, string>();

function clusterKey(serverName: string, tenantId: string): string {
  return `rugpull:${tenantId}:${serverName}`;
}

export async function publishRugPullAlert(
  serverName: string,
  tenantId: string,
  fingerprint: string,
): Promise<void> {
  const key = clusterKey(serverName, tenantId);
  localAlerts.set(key, fingerprint);
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) return;
  try {
    const { Redis: IORedis } = await import('ioredis');
    const client = new IORedis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect();
    await client.set(key, fingerprint, 'EX', 3600);
    await client.publish(`guardian:rugpull:${tenantId}`, JSON.stringify({ serverName, fingerprint }));
    await client.quit();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.warn(`[rug-pull] Redis publish failed: ${msg}`);
  }
}

export async function isClusterRugPullActive(
  serverName: string,
  tenantId: string,
): Promise<boolean> {
  const key = clusterKey(serverName, tenantId);
  if (localAlerts.has(key)) return true;
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) return false;
  try {
    const { Redis: IORedis } = await import('ioredis');
    const client = new IORedis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect();
    const val = await client.get(key);
    await client.quit();
    return Boolean(val);
  } catch {
    return false;
  }
}
