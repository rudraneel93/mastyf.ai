import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('metrics shutdownMetrics', () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.METRICS_ENABLED = 'true';
    process.env.METRICS_MAINTENANCE_INTERVAL_MS = '1000';
  });

  afterEach(async () => {
    const { shutdownMetrics } = await import('../../src/utils/metrics.js');
    await shutdownMetrics();
    process.env = { ...prevEnv };
    vi.restoreAllMocks();
  });

  it('dispose clears maintenance intervals', async () => {
    const metrics = await import('../../src/utils/metrics.js');
    await metrics.startMetricsServer(0);
    expect(metrics.isMetricsMaintenanceActive()).toBe(true);
    await metrics.shutdownMetrics();
    expect(metrics.isMetricsMaintenanceActive()).toBe(false);
  });

  it('dispose alias clears intervals', async () => {
    const metrics = await import('../../src/utils/metrics.js');
    await metrics.startMetricsServer(0);
    expect(metrics.isMetricsMaintenanceActive()).toBe(true);
    await metrics.dispose();
    expect(metrics.isMetricsMaintenanceActive()).toBe(false);
  });
});
