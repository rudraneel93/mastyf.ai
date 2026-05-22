import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { startDashboardServer, closeDashboardServer } from '../../src/utils/dashboard-server.js';

const SPA_OUT = join(process.cwd(), 'deploy', 'dashboard-spa', 'out');
const PORT = 41338;

describe('dashboard SPA static assets', () => {
  beforeAll(async () => {
    process.env.DASHBOARD_ENABLED = 'true';
    process.env.DASHBOARD_AUTH_DISABLED = 'true';
    await startDashboardServer(PORT);
  });

  afterAll(async () => {
    await closeDashboardServer();
    delete process.env.DASHBOARD_ENABLED;
    delete process.env.DASHBOARD_AUTH_DISABLED;
  });

  it('serves /_next/*.js as application/javascript', async () => {
    const chunksDir = join(SPA_OUT, '_next', 'static', 'chunks');
    if (!existsSync(chunksDir)) return;

    const webpack = readdirSync(chunksDir).find((f) => f.startsWith('webpack-') && f.endsWith('.js'));
    if (!webpack) return;

    const res = await fetch(`http://127.0.0.1:${PORT}/_next/static/chunks/${webpack}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/javascript/);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(100);
    expect(body.startsWith('{')).toBe(false);
  });

  it('does not return JavaScript for missing /_next chunk', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/_next/static/chunks/webpack-missing-deadbeef.js`);
    expect(res.status).toBe(404);
    const ct = res.headers.get('content-type') || '';
    expect(ct).not.toMatch(/javascript/);
  });
});
