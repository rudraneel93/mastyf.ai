import { HistoryDatabase } from '../database/history-db.js';
import { McpProxyServer } from './proxy-server.js';
import { McpServerConfig } from '../types.js';
import { Logger } from '../utils/logger.js';

export class ProxyManager {
  private proxies: McpProxyServer[] = [];

  constructor(private db: HistoryDatabase) {}

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
            config.name
          );
          this.proxies.push(proxy);
          Logger.info(`Proxy started for ${config.name} (${config.command})`);
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