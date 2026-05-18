import { CostReport, ToolCost, McpServerConfig, ProxyCallRecord } from '../types.js';
import { TokenCounter, detectProvider } from '../utils/token-counter.js';
import { IDatabase } from '../database/database-interface.js';
import { Logger } from '../utils/logger.js';
import { getRuntimeModelPricing } from './runtime-model-pricing.js';
import { resolveModelId, resolveModelIdForServer } from '../config/llm-config.js';
import { McpClient } from '../utils/mcp-client.js';
import { estimateServerCostFromTools } from '../utils/cost-estimate.js';

/** Daily spend cap from GUARDIAN_DAILY_BUDGET_USD (preferred) or MCP_GUARDIAN_COST_BUDGET. */
export function getDailyBudgetCapUsd(): number {
  const daily = process.env['GUARDIAN_DAILY_BUDGET_USD'] ?? process.env['MCP_GUARDIAN_COST_BUDGET'];
  if (!daily) return 0;
  const cap = parseFloat(daily);
  return Number.isFinite(cap) && cap > 0 ? cap : 0;
}

export class CostAuditor {
  private tokenCounter: TokenCounter;
  private db: IDatabase | undefined;

  constructor(_pricingClient?: unknown, db?: IDatabase, _pricingModel?: string) {
    this.tokenCounter = new TokenCounter();
    this.db = db;
  }

  /** Sum costUsd for all servers since UTC midnight. */
  async getDailySpendUsd(): Promise<number> {
    if (!this.db) return 0;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const cutoff = startOfDay.getTime();
    let total = 0;
    try {
      const names = await this.db.getDistinctActiveServers();
      for (const name of names) {
        const records = await this.db.getCallRecordsForServer(name);
        for (const r of records) {
          const ts = Date.parse(r.timestamp);
          if (!Number.isNaN(ts) && ts >= cutoff) {
            total += r.costUsd ?? 0;
          }
        }
      }
    } catch (err: unknown) {
      Logger.warn(
        `Cost audit: daily spend read failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return Math.round(total * 10000) / 10000;
  }

  async isDailyBudgetExceeded(): Promise<{
    exceeded: boolean;
    spentUsd: number;
    capUsd: number;
  }> {
    const capUsd = getDailyBudgetCapUsd();
    if (capUsd <= 0) {
      return { exceeded: false, spentUsd: 0, capUsd: 0 };
    }
    const spentUsd = await this.getDailySpendUsd();
    return { exceeded: spentUsd >= capUsd, spentUsd, capUsd };
  }

  async getPricingModel(): Promise<string> {
    const active = await getRuntimeModelPricing().getActivePricing();
    if (active) return `${active.displayName} (${active.source})`;
    return resolveModelId() || 'no model detected';
  }

  async auditServer(server: McpServerConfig): Promise<CostReport> {
    if (this.db) {
      try {
        const records = await this.db.getCallRecordsForServer(server.name);
        if (records.length > 0) {
          const report = await this.buildReportFromRecords(server.name, records);
          return { ...report, costSource: 'proxy-records', priced: report.estimatedCostUSD > 0 || !report.unpricedCalls };
        }
      } catch (err: unknown) {
        Logger.warn(`Cost audit: DB read failed for ${server.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return this.estimateCostFromServer(server);
  }

  /** Live or schema-based cost estimate when no proxy call_records exist. */
  private async estimateCostFromServer(server: McpServerConfig): Promise<CostReport> {
    const modelId = resolveModelIdForServer(server.name, server.env);
    const provider = detectProvider(modelId);
    const untrackedSse = server.transport === 'sse' || (!!server.url && !server.command);

    if (!server.command && !server.url) {
      return this.emptyReport(server.name, 'No command or URL configured — cannot probe tools.', {
        modelId,
        provider,
        costSource: 'none',
      });
    }

    const probe = await McpClient.probe(server);
    if (!probe.success || !probe.tools) {
      const reason = probe.error
        ? `Probe failed: ${probe.error}`
        : probe.authRequired
          ? 'Server requires authentication — configure credentials in server env'
          : 'Could not list tools from server';
      const sseNote = untrackedSse
        ? `${reason}. SSE traffic is untracked at runtime unless routed through \`mcp-guardian proxy\` or wrap.`
        : reason;
      return this.emptyReport(server.name, sseNote, { modelId, provider, costSource: 'none' });
    }

    if (probe.tools.length === 0) {
      return this.emptyReport(server.name, 'No tools exposed by server.', {
        modelId,
        provider,
        costSource: 'none',
      });
    }

    const estimate = await estimateServerCostFromTools(probe.tools, modelId, this.tokenCounter);
    const noteParts = [
      `Estimated from ${probe.tools.length} tool definition(s) via tools/list (1 simulated call per tool; token source: estimated)`,
      `Model: ${modelId} (${provider})`,
      !estimate.priced
        ? 'Rates unresolved — set GUARDIAN_MODEL, GUARDIAN_LLM_MODEL, or run with Cline pricing active'
        : null,
      untrackedSse
        ? 'SSE: live IDE traffic still untracked unless clients use Guardian proxy/wrap'
        : null,
    ].filter(Boolean);

    return {
      serverName: server.name,
      tokensUsed: estimate.totalTokens,
      inputTokens: estimate.inputTokens,
      outputTokens: estimate.outputTokens,
      estimatedCostUSD: estimate.costUsd,
      actualCostUSD: 0,
      pricingModel: estimate.pricingModel,
      pricingSources: estimate.pricingSources,
      toolBreakdown: estimate.toolBreakdown,
      unpricedCalls: estimate.unpricedTools > 0 ? estimate.unpricedTools : undefined,
      note: noteParts.join('; '),
      modelId,
      provider,
      costSource: 'estimated',
      priced: estimate.priced,
    };
  }

  private emptyReport(
    serverName: string,
    note: string,
    meta?: Pick<CostReport, 'modelId' | 'provider' | 'costSource' | 'priced'>,
  ): CostReport {
    return {
      serverName,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
      actualCostUSD: 0,
      pricingModel: 'none',
      pricingSources: [],
      toolBreakdown: [],
      unpricedCalls: 0,
      note,
      modelId: meta?.modelId,
      provider: meta?.provider,
      costSource: meta?.costSource ?? 'none',
      priced: meta?.priced ?? false,
    };
  }

  private async buildReportFromRecords(serverName: string, records: ProxyCallRecord[]): Promise<CostReport> {
    const pricing = getRuntimeModelPricing();
    const toolMap = new Map<string, { inputTokens: number; outputTokens: number; calls: number; cost: number; models: Set<string> }>();
    const sources = new Set<string>();
    let totalInput = 0;
    let totalOutput = 0;
    let actualCostUSD = 0;
    let unpricedCalls = 0;
    let apiSourcedCalls = 0;
    let estimatedCalls = 0;
    const active = await pricing.getActivePricing();
    const pricingModel = active?.displayName || active?.modelId || 'unresolved';
    let primaryModel: string | undefined;

    for (const r of records) {
      if (r.tokenSource === 'api') apiSourcedCalls++;
      else if (r.tokenSource === 'estimated') estimatedCalls++;

      const existing = toolMap.get(r.toolName) || {
        inputTokens: 0, outputTokens: 0, calls: 0, cost: 0, models: new Set<string>(),
      };
      existing.inputTokens += r.requestTokens;
      existing.outputTokens += r.responseTokens;
      existing.calls += 1;

      let callCost = r.costUsd ?? 0;
      if (callCost <= 0 && r.model) {
        const resolved = await pricing.resolveModelId(r.model);
        if (resolved) {
          callCost = pricing.computeCost(r.requestTokens, r.responseTokens, resolved).costUsd;
          if (callCost > 0) sources.add(resolved.source);
        }
      } else if (callCost > 0 && r.pricingSource) {
        sources.add(r.pricingSource);
      }

      if (callCost > 0) {
        existing.cost += callCost;
        actualCostUSD += callCost;
      } else if ((r.requestTokens || 0) + (r.responseTokens || 0) > 0) {
        unpricedCalls++;
      }

      if (r.model) {
        existing.models.add(r.model);
        primaryModel = primaryModel || r.model;
      }
      toolMap.set(r.toolName, existing);
      totalInput += r.requestTokens;
      totalOutput += r.responseTokens;
    }

    if (active) sources.add(active.source);

    const breakdown: ToolCost[] = [];
    for (const [toolName, data] of toolMap) {
      breakdown.push({
        toolName,
        tokens: data.inputTokens + data.outputTokens,
        calls: data.calls,
        cost: Math.round(data.cost * 10000) / 10000,
      });
    }

    const modelId = primaryModel || resolveModelId();

    return {
      serverName,
      tokensUsed: totalInput + totalOutput,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      estimatedCostUSD: Math.round(actualCostUSD * 10000) / 10000,
      actualCostUSD: Math.round(actualCostUSD * 10000) / 10000,
      pricingModel,
      pricingSources: [...sources],
      toolBreakdown: breakdown,
      unpricedCalls,
      modelId,
      provider: detectProvider(modelId),
      note: [
        unpricedCalls > 0
          ? `${unpricedCalls} call(s) could not be priced — ensure Cline is active or set GUARDIAN_MODEL`
          : null,
        apiSourcedCalls > 0 || estimatedCalls > 0
          ? `Token sources: ${apiSourcedCalls} API, ${estimatedCalls} estimated (USD only)`
          : null,
      ]
        .filter(Boolean)
        .join('; ') || undefined,
    };
  }

  countTokens(text: string): number {
    return this.tokenCounter.count(text);
  }

  dispose(): void {
    this.tokenCounter.free();
  }
}
