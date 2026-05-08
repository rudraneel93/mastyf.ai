import { CostReport, ToolCost, McpServerConfig } from '../types.js';
import { TokenCounter } from '../utils/token-counter.js';
import { PricingClient } from '../clients/pricing-client.js';
import { HistoryDatabase } from '../database/history-db.js';
import { Logger } from '../utils/logger.js';

/**
 * Estimates token usage and costs per MCP server.
 * Now reads real call records from the proxy-intercepted database.
 * Falls back to a note instructing the user to use the proxy if no data exists.
 */
export class CostAuditor {
  private tokenCounter: TokenCounter;
  private pricing: PricingClient;
  private db: HistoryDatabase;

  constructor(pricingClient?: PricingClient, db?: HistoryDatabase) {
    this.tokenCounter = new TokenCounter();
    this.pricing = pricingClient || new PricingClient();
    // DB is optional — if not provided, we fallback to note mode
    this.db = db as HistoryDatabase;
  }

  /**
   * Audit costs for a server using real proxy-intercepted call records.
   * If no DB is available or no records exist, returns a note instead of fake data.
   */
  async auditServer(server: McpServerConfig): Promise<CostReport> {
    // Try to get real data from proxy-intercepted call records
    if (this.db) {
      try {
        const records = await this.db.getCallRecordsForServer(server.name);
        if (records.length > 0) {
          return this.buildReportFromRecords(server.name, records);
        }
      } catch (err: any) {
        Logger.debug(`Cost audit: DB read failed for ${server.name}: ${err?.message}`);
      }
    }

    // No real data available — return a clear note (zero mock data)
    return {
      serverName: server.name,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
      pricingModel: 'unknown',
      toolBreakdown: [],
      note: 'No recorded call data. Use `mcp-doctor proxy` to capture real token usage, or provide call logs via --call-log.',
    };
  }

  /**
   * Build a cost report from real proxy-intercepted call records.
   */
  private buildReportFromRecords(serverName: string, records: { toolName: string; totalTokens: number }[]): CostReport {
    const pricingModel = 'gpt-4o';
    const toolMap = new Map<string, { tokens: number; calls: number }>();

    for (const record of records) {
      const existing = toolMap.get(record.toolName) || { tokens: 0, calls: 0 };
      existing.tokens += record.totalTokens;
      existing.calls += 1;
      toolMap.set(record.toolName, existing);
    }

    const breakdown: ToolCost[] = [];
    let totalTokens = 0;

    for (const [tool, data] of toolMap) {
      const inputTokens = Math.round(data.tokens * 0.7);
      const outputTokens = Math.round(data.tokens * 0.3);
      const cost =
        this.pricing.calculateCost(inputTokens, pricingModel, false) +
        this.pricing.calculateCost(outputTokens, pricingModel, true);

      breakdown.push({ toolName: tool, tokens: data.tokens, calls: data.calls, cost });
      totalTokens += data.tokens;
    }

    const totalCost = breakdown.reduce((sum, t) => sum + t.cost, 0);
    return {
      serverName,
      tokensUsed: totalTokens,
      inputTokens: Math.round(totalTokens * 0.7),
      outputTokens: Math.round(totalTokens * 0.3),
      estimatedCostUSD: Math.round(totalCost * 10000) / 10000,
      pricingModel,
      toolBreakdown: breakdown,
    };
  }

  countTokens(text: string): number {
    return this.tokenCounter.count(text);
  }

  dispose(): void {
    this.tokenCounter.free();
  }
}