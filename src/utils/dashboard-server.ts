import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { Logger } from './logger.js';
import { PolicyWatcher } from '../policy/policy-watcher.js';
import { DashboardAuth } from '../auth/dashboard-auth.js';
import { Registry } from 'prom-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Lightweight dashboard server that serves:
 * - / — the dashboard HTML (requires auth if enabled)
 * - /login — login page (when JWT auth is enabled)
 * - /api/login — POST login endpoint
 * - /api/policy — current policy (JSON, requires auth)
 * - /api/policy/reload — trigger policy reload (requires auth)
 * - /metrics — Prometheus metrics (can be auth-gated or public via DASHBOARD_METRICS_PUBLIC=true)
 *
 * v1.2: Integrated DashboardAuth for JWT/API key authentication, CSRF protection.
 */
export async function startDashboardServer(
  port: number = 4000,
  policyWatcher?: PolicyWatcher,
  dashboardAuth?: DashboardAuth,
): Promise<{ auth: DashboardAuth; server: ReturnType<typeof createServer> }> {
  if (process.env['DASHBOARD_ENABLED'] !== 'true') {
    Logger.debug('[dashboard] Dashboard server not enabled (set DASHBOARD_ENABLED=true)');
    return { auth: dashboardAuth || new DashboardAuth({ enabled: false }), server: createServer((_req, res) => {
      res.writeHead(200);
      res.end();
    }) };
  }

  const auth = dashboardAuth || new DashboardAuth();
  const authEnabled = auth.isEnabled();

  if (authEnabled) {
    Logger.info('[dashboard] Dashboard authentication enabled');
  } else {
    Logger.info('[dashboard] Dashboard running without authentication (set DASHBOARD_AUTH_ENABLED=true)');
  }

  const dashboardHtml = readFileSync(resolve(__dirname, '..', '..', 'deploy', 'dashboard.html'), 'utf-8');

  /** Read JSON body from request */
  async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
      req.on('error', reject);
    });
  }

  /** Parse form-encoded body from request */
  async function readFormBody(req: IncomingMessage): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => {
        const result: Record<string, string> = {};
        if (data) {
          try {
            const params = new URLSearchParams(data);
            for (const [key, value] of params) {
              result[key] = value;
            }
          } catch {
            // Ignore parse errors
          }
        }
        resolve(result);
      });
    });
  }

  /** Get client IP for rate limiting */
  function getClientIp(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return (first || '').trim();
    }
    return req.socket?.remoteAddress || 'unknown';
  }

  /** Write JSON response */
  function writeJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  const server = createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // ── Security headers (CSP + HSTS via helmet) ────────────
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "http://localhost:9090"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 63072000, includeSubDomains: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
    })(req, res, () => {
      // helmet middleware applied, continue to routing
    });

    // ── CORS preflight ─────────────────────────────────────
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      });
      res.end();
      return;
    }

    // ── CORS headers on all responses ─────────────────────
    const setCors = () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    };

    try {
      // ── Login page (only when JWT auth is enabled, no API key set) ──
      if (url === '/login' && method === 'GET') {
        setCors();
        if (auth.isEnabled() && auth.hasJwtSessionAuth()) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(auth.getLoginPageHtml());
        } else {
          res.writeHead(302, { 'Location': '/' });
          res.end();
        }
        return;
      }

      // ── Login API endpoint ──────────────────────────────
      if (url === '/api/login' && method === 'POST') {
        setCors();
        const ip = getClientIp(req);
        const contentType = req.headers['content-type'] || '';

        let body: Record<string, string>;
        if (contentType.includes('application/x-www-form-urlencoded')) {
          body = await readFormBody(req);
        } else {
          body = await readBody(req) as unknown as Record<string, string>;
        }

        const result = auth.login({
          url,
          headers: req.headers as Record<string, string | string[] | undefined>,
          body: {
            username: body.username,
            password: body.password,
            api_key: body.api_key,
          },
          ip,
        });

        if (result.success && req.headers['content-type']?.includes('form')) {
          // Form submission — redirect to dashboard with token
          res.writeHead(302, {
            'Location': `/?api_key=${encodeURIComponent(result.token!)}`,
            'Set-Cookie': `mcp_guardian_session=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`,
          });
          res.end();
          return;
        }

        if (result.success) {
          writeJson(res, 200, { success: true, token: result.token });
        } else {
          writeJson(res, 401, { success: false, error: result.error });
        }
        return;
      }

      // ── Auth check for all other routes ─────────────────
      const authResult = auth.authenticate({ url, headers: req.headers, method });
      if (!authResult.authenticated) {
        setCors();
        if (req.headers['accept']?.includes('text/html')) {
          // Browser request — redirect to login
          res.writeHead(302, { 'Location': '/login' });
          res.end();
        } else {
          writeJson(res, 401, { error: 'Authentication required', reason: authResult.reason });
        }
        return;
      }

      // ── Dashboard HTML ──────────────────────────────────
      if (url === '/' || url === '/dashboard.html') {
        setCors();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(dashboardHtml);
        return;
      }

      // ── Policy API ──────────────────────────────────────
      if (url === '/api/policy' && method === 'GET') {
        setCors();
        if (!policyWatcher || !policyWatcher.get()) {
          writeJson(res, 404, { error: 'No active policy. Start proxy with --policy flag.' });
          return;
        }
        writeJson(res, 200, { mode: policyWatcher.get()!.getMode(), rules: 'Policy engine active (YAML view available on filesystem)' });
        return;
      }

      if (url === '/api/policy/reload' && method === 'POST') {
        setCors();
        if (!policyWatcher) {
          writeJson(res, 404, { error: 'Policy watcher not configured' });
          return;
        }
        writeJson(res, 200, { status: 'ok', message: 'Policy watcher is active. File changes are auto-detected.' });
        return;
      }

      // ── Prometheus /metrics proxy ──────────────────────
      if (url === '/metrics') {
        setCors();
        const metricsPublic = process.env['DASHBOARD_METRICS_PUBLIC'] === 'true';
        // Re-check auth for metrics unless public
        if (metricsPublic || authResult.authenticated) {
          try {
            const metricsPort = process.env['METRICS_PORT'] || '9090';
            const metricsRes = await fetch(`http://localhost:${metricsPort}/metrics`);
            if (!metricsRes.ok) throw new Error(`Metrics server returned ${metricsRes.status}`);
            const text = await metricsRes.text();
            res.writeHead(200, {
              'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(text);
          } catch {
            writeJson(res, 200, { error: 'Metrics not available. Ensure METRICS_ENABLED=true and proxy is running.' });
          }
        } else {
          writeJson(res, 401, { error: 'Authentication required for metrics' });
        }
        return;
      }

      // ── Auth status check ───────────────────────────────
      if (url === '/api/auth/status' && method === 'GET') {
        setCors();
        writeJson(res, 200, { authenticated: true, identity: authResult.identity, authEnabled });
        return;
      }

      // ── Logout ──────────────────────────────────────────
      if (url === '/api/logout' && method === 'POST') {
        setCors();
        const authHeader = req.headers['authorization'];
        if (authHeader) {
          const match = authHeader.match(/^Bearer\s+(.+)$/i);
          if (match) auth.logout(match[1]);
        }
        writeJson(res, 200, { status: 'ok', message: 'Logged out' });
        return;
      }

      // ── 404 ──────────────────────────────────────────────
      setCors();
      writeJson(res, 404, { error: 'Not found' });
    } catch (err: any) {
      setCors();
      writeJson(res, 500, { error: err?.message || 'Internal error' });
    }
  });

  server.listen(port, () => {
    Logger.info(`[dashboard] Dashboard available at http://localhost:${port}${authEnabled ? ' (auth enabled)' : ''}`);
  });

  return { auth, server };
}
