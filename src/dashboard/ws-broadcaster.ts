import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { Logger } from '../utils/logger.js';
import { DEFAULT_TENANT_ID, validateTenantId, InvalidTenantIdError } from '../tenant/resolve-tenant.js';
import type { AuditTrailSync } from '../aggregator/audit-trail-sync.js';
import type { TelemetryCollector } from '../aggregator/telemetry-collector.js';
import type { LogShipper } from '../aggregator/log-shipper.js';

/**
 * WebSocket push broadcaster — replaces polling with real-time push
 * for dashboard updates. Channels: policy, AI, audit, metrics, logs.
 * Clients subscribe with tenantId; pushes are scoped per connection.
 */
export class WsBroadcaster {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private clientSubscriptions = new Map<WebSocket, Set<string>>();
  private clientTenants = new Map<WebSocket, string>();
  private auditSync?: AuditTrailSync;
  private telemetryCollector?: TelemetryCollector;
  private logShipper?: LogShipper;
  private pushInterval?: ReturnType<typeof setInterval>;

  /** Live data providers (tenant-scoped where noted) */
  private dataProviders: {
    suggestions?: (tenantId: string) => unknown[];
    baselines?: (tenantId: string) => unknown[];
    aiReport?: (tenantId: string) => unknown;
    aiState?: (tenantId: string) => unknown;
    threats?: (tenantId: string) => unknown[];
    policyRules?: () => unknown;
    metrics?: (tenantId: string) => Promise<unknown> | unknown;
    auditTrail?: (tenantId: string) => Promise<unknown[]> | unknown[];
    logs?: (tenantId: string) => string[];
    instances?: (tenantId: string) => unknown[];
  } = {};

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('error', (err) => {
      Logger.warn(`[dashboard] WebSocket server error: ${err.message}`);
    });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this.clientSubscriptions.set(ws, new Set(['policy', 'health', 'metrics']));
      this.clientTenants.set(ws, DEFAULT_TENANT_ID);
      Logger.debug('[dashboard] WS client connected');

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            type?: string;
            channels?: string[];
            tenantId?: string;
          };
          if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
            this.clientSubscriptions.set(ws, new Set(msg.channels));
            if (msg.tenantId?.trim()) {
              try {
                this.clientTenants.set(ws, validateTenantId(msg.tenantId));
              } catch (err) {
                if (err instanceof InvalidTenantIdError) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    payload: { error: err.message },
                    timestamp: Date.now(),
                  }));
                }
              }
            }
            Logger.debug(
              `[dashboard] WS subscribed tenant=${this.clientTenants.get(ws)} channels=${msg.channels.join(', ')}`,
            );
          } else if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.clientSubscriptions.delete(ws);
        this.clientTenants.delete(ws);
        Logger.debug('[dashboard] WS client disconnected');
      });

      ws.on('error', (err) => {
        Logger.warn('[dashboard] WS client error: ' + err.message);
        this.clients.delete(ws);
        this.clientSubscriptions.delete(ws);
        this.clientTenants.delete(ws);
      });

      this.sendSnapshot(ws).catch(() => {});
    });
  }

  setDataProviders(providers: typeof this.dataProviders): void {
    this.dataProviders = { ...this.dataProviders, ...providers };
  }

  setAggregators(auditSync?: AuditTrailSync, telemetryCollector?: TelemetryCollector, logShipper?: LogShipper): void {
    this.auditSync = auditSync;
    this.telemetryCollector = telemetryCollector;
    this.logShipper = logShipper;
  }

  private matchesTenant(client: WebSocket, eventTenantId?: string): boolean {
    if (!eventTenantId) return true;
    return this.clientTenants.get(client) === eventTenantId;
  }

  /**
   * Broadcast to clients subscribed to the channel and matching tenantId (when set).
   */
  broadcast(event: DashboardEvent, eventTenantId?: string): void {
    const tenantId = eventTenantId ?? event.tenantId;
    const payload = JSON.stringify(event);
    const channel = this.eventToChannel(event.type);

    for (const client of this.clients) {
      const subs = this.clientSubscriptions.get(client);
      if (
        subs
        && subs.has(channel)
        && client.readyState === WebSocket.OPEN
        && this.matchesTenant(client, tenantId)
      ) {
        try {
          client.send(payload);
        } catch (err) {
          Logger.debug(`[dashboard] WS send failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    }
  }

  startDataPushLoop(intervalMs: number = 5000): ReturnType<typeof setInterval> {
    if (this.pushInterval) return this.pushInterval;
    Logger.info(`[dashboard] WS data push loop started (${intervalMs}ms)`);
    this.pushInterval = setInterval(() => {
      if (this.clients.size === 0) return;
      this.pushLiveData().catch((err) => {
        Logger.warn(`[dashboard] WS push error: ${err?.message}`);
      });
    }, intervalMs);
    return this.pushInterval;
  }

  stopDataPushLoop(): void {
    if (this.pushInterval) {
      clearInterval(this.pushInterval);
      this.pushInterval = undefined;
      Logger.info('[dashboard] WS data push loop stopped');
    }
  }

  private async pushLiveDataForClient(client: WebSocket): Promise<DashboardEvent[]> {
    const tenantId = this.clientTenants.get(client) || DEFAULT_TENANT_ID;
    const batch: DashboardEvent[] = [];

    if (this.dataProviders.suggestions) {
      const suggestions = this.dataProviders.suggestions(tenantId);
      batch.push({
        type: 'ai:suggestions',
        tenantId,
        payload: { suggestions: suggestions || [] },
        timestamp: Date.now(),
      });
    }

    if (this.dataProviders.baselines) {
      const baselines = this.dataProviders.baselines(tenantId);
      batch.push({
        type: 'ai:baselines',
        tenantId,
        payload: { baselines: baselines || [] },
        timestamp: Date.now(),
      });
    }

    if (this.dataProviders.aiReport) {
      batch.push({
        type: 'ai:report',
        tenantId,
        payload: { report: this.dataProviders.aiReport(tenantId) },
        timestamp: Date.now(),
      });
    }

    if (this.dataProviders.aiState) {
      batch.push({
        type: 'ai:state',
        tenantId,
        payload: { state: this.dataProviders.aiState(tenantId) },
        timestamp: Date.now(),
      });
    }

    if (this.dataProviders.threats) {
      const threats = this.dataProviders.threats(tenantId);
      batch.push({
        type: 'ai:threats',
        tenantId,
        payload: { threats: threats || [] },
        timestamp: Date.now(),
      });
    }

    if (this.dataProviders.metrics) {
      try {
        const metrics = await Promise.resolve(this.dataProviders.metrics(tenantId));
        batch.push({
          type: 'metrics:live',
          tenantId,
          payload: { metrics },
          timestamp: Date.now(),
        });
      } catch {
        /* skip */
      }
    } else if (this.telemetryCollector) {
      try {
        const instances = await this.telemetryCollector.getActiveInstances();
        batch.push({
          type: 'metrics:live',
          tenantId,
          payload: { instances },
          timestamp: Date.now(),
        });
      } catch {
        /* skip */
      }
    }

    if (this.dataProviders.auditTrail) {
      try {
        const trail = await Promise.resolve(this.dataProviders.auditTrail(tenantId));
        batch.push({
          type: 'audit:events',
          tenantId,
          payload: { events: trail || [] },
          timestamp: Date.now(),
        });
      } catch {
        /* skip */
      }
    }

    if (this.dataProviders.logs) {
      const logs = this.dataProviders.logs(tenantId);
      batch.push({
        type: 'logs:recent',
        tenantId,
        payload: { logs: logs || [] },
        timestamp: Date.now(),
      });
    }

    if (this.dataProviders.instances) {
      batch.push({
        type: 'instances:list',
        tenantId,
        payload: { instances: this.dataProviders.instances(tenantId) },
        timestamp: Date.now(),
      });
    }

    return batch;
  }

  private async pushLiveData(): Promise<void> {
    for (const client of this.clients) {
      const batch = await this.pushLiveDataForClient(client);
      for (const event of batch) {
        const channel = this.eventToChannel(event.type);
        const subs = this.clientSubscriptions.get(client);
        if (subs?.has(channel) && client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(event));
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  private async sendSnapshot(ws: WebSocket): Promise<void> {
    const tenantId = this.clientTenants.get(ws) || DEFAULT_TENANT_ID;
    const snapshot: DashboardEvent = {
      type: 'snapshot',
      tenantId,
      payload: {
        message: 'Connected to MCP Guardian dashboard',
        uptime: process.uptime(),
        version: process.env.npm_package_version || '2.3.24',
        timestamp: new Date().toISOString(),
        tenantId,
      },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(snapshot));

    if (this.dataProviders.aiState) {
      ws.send(JSON.stringify({
        type: 'ai:state',
        tenantId,
        payload: { state: this.dataProviders.aiState(tenantId) },
        timestamp: Date.now(),
      }));
    }
    if (this.dataProviders.metrics) {
      Promise.resolve(this.dataProviders.metrics(tenantId))
        .then((metrics) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'metrics:live',
              tenantId,
              payload: { metrics },
              timestamp: Date.now(),
            }));
          }
        })
        .catch(() => {});
    }
  }

  eventToChannel(type: DashboardEventType): string {
    if (type.startsWith('flow:')) return 'flow';
    if (type.startsWith('swarm:')) return 'swarm';
    if (type.startsWith('semantic:')) return 'flow';
    if (type.startsWith('analysis:')) return 'swarm';
    if (type.startsWith('ai:')) return 'ai';
    if (type.startsWith('audit:')) return 'audit';
    if (type.startsWith('metrics:')) return 'metrics';
    if (type.startsWith('logs:')) return 'logs';
    if (type.startsWith('instances:')) return 'instances';
    if (type === 'policy-block' || type === 'policy-reload') return 'policy';
    if (type === 'health-change' || type === 'circuit-breaker-open') return 'health';
    if (type === 'cost-threshold') return 'cost';
    return 'policy';
  }

  getClientCount(): number {
    return this.clients.size;
  }

  /** Test helper: tenant bound to a client socket */
  getClientTenant(ws: WebSocket): string | undefined {
    return this.clientTenants.get(ws);
  }
}

export type DashboardEventType =
  | 'policy-block'
  | 'health-change'
  | 'cost-threshold'
  | 'circuit-breaker-open'
  | 'policy-reload'
  | 'ai:suggestions'
  | 'ai:baselines'
  | 'ai:report'
  | 'ai:state'
  | 'ai:threats'
  | 'audit:events'
  | 'audit:decision'
  | 'metrics:live'
  | 'metrics:history'
  | 'logs:recent'
  | 'logs:alert'
  | 'instances:list'
  | 'instances:status'
  | 'flow:step'
  | 'swarm:progress'
  | 'swarm:done'
  | 'swarm:failed'
  | 'semantic:queued'
  | 'semantic:complete'
  | 'analysis:artifact'
  | 'snapshot';

export interface DashboardEvent {
  type: DashboardEventType;
  serverName?: string;
  tenantId?: string;
  payload: Record<string, unknown>;
  timestamp: number;
}
