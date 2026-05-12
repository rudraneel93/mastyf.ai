/**
 * Shared scoring utility used by both index.ts (MCP server) and cli.ts (CLI).
 *
 * v2.3.4: Now includes cost efficiency as a third scoring dimension.
 * Final score = weighted average of security (40%), health (30%), cost efficiency (30%).
 * Cost efficiency = how well your setup uses cheaper models / avoids expensive ones.
 *
 * Cost efficiency scoring:
 *  100 = using exclusively free/cheapest models (gemini-flash, deepseek)
 *   80 = mostly cheap + some mid-tier (gpt-4o, claude-sonnet)
 *   50 = heavy use of mid-tier models
 *   20 = heavy use of expensive models (gpt-4.5-preview)
 *
 * When costs data is not available, falls back to security+health only (50/50 split).
 */

// Reference pricing per 1M input tokens (April 2026 litellm data)
const MODEL_COST_TIERS: Record<string, number> = {
  'gemini-2.0-flash': 0.10,
  'gemini-2.0-flash-lite': 0.075,
  'gemini-1.5-flash': 0.075,
  'deepseek-chat': 0.28,
  'deepseek-reasoner': 0.55,
  'gpt-4o-mini': 0.15,
  'gpt-4o': 2.50,
  'claude-3-5-sonnet': 3.00,
  'claude-3-5-haiku': 0.80,
  'claude-3-opus': 15.00,
  'gpt-4.5-preview': 75.00,
  'gpt-4-turbo': 10.00,
  'o1-preview': 15.00,
  'o1-mini': 3.00,
  'mistral-large': 4.00,
  'mistral-small': 1.00,
  'llama-3.1-405b': 3.50,
  'llama-3.1-70b': 0.59,
};

function getCostEfficiency(costs: { estimatedCostUSD: number; pricingModel: string }[]): number {
  if (costs.length === 0) return 0;

  let totalCost = 0;
  let totalTokens = 0;
  let approximateInputRate = 0;

  for (const c of costs) {
    totalCost += c.estimatedCostUSD;
    const rate = MODEL_COST_TIERS[c.pricingModel] ?? 2.50; // Default to gpt-4o pricing
    approximateInputRate += rate;
    totalTokens++;
  }

  if (totalCost === 0) return 100; // Free tier - perfect
  if (totalTokens === 0) return 50;

  const avgModelCost = approximateInputRate / totalTokens;

  // Score: 100 for free/cheapest ($0-$0.30/M), 50 for mid-tier ($2-$5/M), 0 for expensive ($50+/M)
  if (avgModelCost <= 0.30) return 100;
  if (avgModelCost <= 1.0) return 90;
  if (avgModelCost <= 3.0) return 70;
  if (avgModelCost <= 5.0) return 50;
  if (avgModelCost <= 15.0) return 30;
  if (avgModelCost <= 40.0) return 15;
  return 5;
}

export function calculateOverallScore(
  security: { score: number }[],
  health: { successRate: number }[],
  costs?: { estimatedCostUSD: number; pricingModel: string }[]
): number {
  if (security.length === 0 && health.length === 0) return 0;

  const secAvg = security.length > 0
    ? security.reduce((sum, s) => sum + s.score, 0) / security.length
    : 0;
  const healthAvg = health.length > 0
    ? health.reduce((sum, h) => sum + h.successRate * 100, 0) / health.length
    : 0;

  // If cost data is available, use weighted 3-way scoring
  if (costs && costs.length > 0) {
    const costEff = getCostEfficiency(costs);
    if (security.length === 0 && health.length === 0) return Math.round(costEff);
    if (security.length === 0) return Math.round((healthAvg * 0.5) + (costEff * 0.5));
    if (health.length === 0) return Math.round((secAvg * 0.6) + (costEff * 0.4));
    return Math.round((secAvg * 0.40) + (healthAvg * 0.30) + (costEff * 0.30));
  }

  // Fallback: security + health only
  if (security.length === 0) return Math.round(healthAvg);
  if (health.length === 0) return Math.round(secAvg);
  return Math.round((secAvg + healthAvg) / 2);
}