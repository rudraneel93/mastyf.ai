import { Logger } from '../utils/logger.js';

export const PRICING_TABLE_DATE = '2025-05-01';
export const PRICING_STALENESS_DAYS = 30;

export function getPricingStalenessWarning(): string | null {
  const tableDate = new Date(PRICING_TABLE_DATE);
  const ageMs     = Date.now() - tableDate.getTime();
  const ageDays   = Math.floor(ageMs / 86_400_000);

  if (ageDays > PRICING_STALENESS_DAYS) {
    return `Pricing table is ${ageDays} days old (last updated ${PRICING_TABLE_DATE}). Run "npm install -g @mcp-guardian/server@latest" to get current prices.`;
  }
  return null;
}

// Model pricing per 1M input tokens (April 2026 reference)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4.5-preview':   { input: 75.00, output: 150.00 },
  'gpt-4-turbo':       { input: 10.00, output: 30.00 },
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60 },
  'o1-preview':        { input: 15.00, output: 60.00 },
  'o1-mini':           { input: 3.00,  output: 12.00 },
  'claude-3-opus':     { input: 15.00, output: 75.00 },
  'claude-3-5-sonnet': { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku':  { input: 0.80,  output: 4.00 },
  'gemini-2.0-flash':  { input: 0.10,  output: 0.40 },
  'gemini-1.5-pro':    { input: 1.25,  output: 5.00 },
  'deepseek-chat':     { input: 0.28,  output: 0.42 },
  'deepseek-reasoner': { input: 0.55,  output: 2.19 },
  'llama-3.1-405b':    { input: 3.50,  output: 3.50 },
  'llama-3.1-70b':     { input: 0.59,  output: 0.79 },
  'mistral-large':     { input: 4.00,  output: 12.00 },
  'mistral-small':     { input: 1.00,  output: 3.00 },
};

export class PricingClient {
  getModelPricing(model: string): { input: number; output: number } | undefined {
    return MODEL_PRICING[model];
  }

  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o'] ?? { input: 2.50, output: 10.00 };
    const inputCost  = (inputTokens  / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  getAvailableModels(): string[] {
    return Object.keys(MODEL_PRICING);
  }

  getPricingDate(): string {
    return PRICING_TABLE_DATE;
  }
}