/**
 * Cached token pricing from major LLM providers.
 * Rates per 1M tokens (as of mid-2025).
 * Can be overridden via PRICING_OVERRIDES env var (JSON) or .env file.
 */
const DEFAULT_PRICING_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
};

function loadCustomPricing(): Record<string, { input: number; output: number }> {
  const overrides = process.env['PRICING_OVERRIDES'];
  if (!overrides) return {};

  try {
    const parsed = JSON.parse(overrides);
    const result: Record<string, { input: number; output: number }> = {};
    for (const [model, rates] of Object.entries(parsed)) {
      const r = rates as Record<string, unknown>;
      if (typeof r.input === 'number' && typeof r.output === 'number') {
        result[model] = { input: r.input, output: r.output };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export class PricingClient {
  private prices: Record<string, { input: number; output: number }>;

  constructor() {
    const custom = loadCustomPricing();
    this.prices = { ...DEFAULT_PRICING_TABLE, ...custom };
  }

  /**
   * Calculate estimated cost for a given number of tokens.
   */
  calculateCost(tokens: number, model: string, isOutput: boolean = false): number {
    const price = this.prices[model];
    if (!price) {
      // Unknown model — use a conservative default of $10/M input, $30/M output
      const rate = isOutput ? 30.0 : 10.0;
      return (tokens / 1_000_000) * rate;
    }
    const rate = isOutput ? price.output : price.input;
    return (tokens / 1_000_000) * rate;
  }

  /**
   * Get the full pricing record for a model, or null if unknown.
   */
  getPricingForModel(model: string): { input: number; output: number } | null {
    return this.prices[model] ?? null;
  }

  /**
   * List all known model pricing entries.
   */
  listModels(): string[] {
    return Object.keys(this.prices);
  }

  /**
   * Add or update pricing for a model at runtime.
   */
  addPricing(model: string, inputCost: number, outputCost: number): void {
    this.prices[model] = { input: inputCost, output: outputCost };
  }
}