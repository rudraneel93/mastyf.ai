import { HistoryDatabase } from '../database/history-db.js';
import { McpProxyServer } from './proxy-server.js';
import { McpServerConfig } from '../types.js';
import { Logger } from '../utils/logger.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { PolicyWatcher } from '../policy/policy-watcher.js';
import { OAuthValidator } from '../auth/oauth.js';
import { StructuredLogger } from '../utils/structured-logger.js';

export class ProxyManager {
  private proxies: McpProxyServer[] = [];
  private policyEngine: PolicyEngine | undefined;

  constructor(
    private db: HistoryDatabase,
    policyEngineOrWatcher?: PolicyEngine | PolicyWatcher,
    private authValidator?: OAuthValidator,
  ) {
    // Resolve PolicyWatcher → current engine on construction
    if (policyEngineOrWatcher instanceof PolicyWatcher) {
      this.policyEngine = policyEngineOrWatcher.get() ?? undefined;
      // Register hot-reload callback: on policy file change, atomically swap engines on all proxies
      const updateEngine = () => {
        const newEngine = policyEngineOrWatcher!.get();
        if (newEngine) {
          this.policyEngine = newEngine;
          for (const proxy of this.proxies) {
            proxy.setPolicyEngine(newEngine);
          }
          Logger.info(`[proxy-manager] Policy hot-reloaded across ${this.proxies.length} proxy(s)`);
        }
      };
      (policyEngineOrWatcher as PolicyWatcher).onReload = updateEngine;
    } else {
      this.policyEngine = policyEngineOrWatcher ?? undefined;
    }
  }

  getProxies(): McpProxyServer[] {
    return this.proxies;
  }

  async startAll(configs: McpServerConfig[]): Promise<void> {
    // ── HTTP/SSE proxy gap warning ──────────────────────────
    const sseServers = configs.filter((c) => c.transport === 'sse' || c.url);
    const stdioServers = configs.filter(
      (c) => c.transport === 'stdio' && c.command
    );

    if (sseServers.length > 0) {
      const names = sseServers.map((s) => `   • ${s.name} (${s.url || 'unknown'})`).join('\n');
      Logger.warn(
        `⚠  PROXY LIMITATION: The following servers use HTTP/SSE transport ` +
          `and CANNOT be intercepted by the stdio proxy.\n` +
          `Policy enforcement and token tracking are INACTIVE for these servers:\n` +
          `${names}\n` +
          `To protect HTTP/SSE servers, use an HTTP reverse proxy with mcp-guardian ` +
          `as middleware (see docs/http-proxy-mode.md).`
      );
      StructuredLogger.info({
        event: 'sse_proxy_gap',
        sseServerCount: sseServers.length,
        sseServerNames: sseServers.map((s) => s.name),
      });
    }

    for (const config of stdioServers) {
      try {
        // Sanitise environment — only pass configured env + non-secret system vars
        const sanitizedEnv: Record<string, string> = {
          ...(config.env || {}),
          PATH: process.env['PATH'] || '',
          HOME: process.env['HOME'] || '',
        };

        const proxy = new McpProxyServer(
          config.command!,
          config.args || [],
          sanitizedEnv,
          this.db,
          config.name,
          this.policyEngine,
          this.authValidator,
        );
        this.proxies.push(proxy);
        const extras: string[] = [];
        if (this.policyEngine) extras.push(`policy: ${this.policyEngine.getMode()}`);
        if (this.authValidator) extras.push('auth: OAuth 2.1');
        Logger.info(
          `Proxy started for ${config.name} (${config.command})${extras.length ? ` [${extras.join(', ')}]` : ''}`
        );
      } catch (err: any) {
        Logger.error(`Failed to start proxy for ${config.name}: ${err?.message}`);
      }
    }

    if (sseServers.length > 0 && stdioServers.length === 0) {
      Logger.warn(
        'All configured servers use HTTP/SSE transport. The stdio proxy cannot intercept any of them. ' +
          'Runtime protection is ZERO.'
      );
    }
  }

  stopAll(): void {
    for (const proxy of this.proxies) {
      proxy.kill();
    }
    this.proxies = [];
    Logger.info('All proxies stopped');
  }
}