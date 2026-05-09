import { HistoryDatabase } from '../database/history-db.js';
import { McpProxyServer } from './proxy-server.js';
import { McpServerConfig } from '../types.js';
import { Logger } from '../utils/logger.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { OAuthValidator } from '../auth/oauth.js';

export class ProxyManager {
  private proxies: McpProxyServer[] = [];

  constructor(
    private db: HistoryDatabase,
    private policyEngine?: PolicyEngine,
    private authValidator?: OAuthValidator,
  ) {}

  getProxies(): McpProxyServer[] {
    return this.proxies;
  }

  async startAll(configs: McpServerConfig[]): Promise<void> {
    for (const config of configs) {
      if (config.transport === 'stdio' && config.command) {
        try {
          const proxy = new McpProxyServer(
            config.command,
            config.args || [],
            config.env || {},
            this.db,
            config.name,
            this.policyEngine,
            this.authValidator,
          );
          this.proxies.push(proxy);
          const extras: string[] = [];
          if (this.policyEngine) extras.push(`policy: ${this.policyEngine.getMode()}`);
          if (this.authValidator) extras.push('auth: OAuth 2.1');
          Logger.info(`Proxy started for ${config.name} (${config.command})${extras.length ? ` [${extras.join(', ')}]` : ''}`);
        } catch (err: any) {
          Logger.error(`Failed to start proxy for ${config.name}: ${err?.message}`);
        }
      } else if (config.url) {
        Logger.info(`SSE proxy for ${config.name} not yet supported — skipping`);
      }
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