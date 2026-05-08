/**
 * Shared scoring utility used by both index.ts (MCP server) and cli.ts (CLI).
 */
export function calculateOverallScore(
  security: { score: number }[],
  health: { successRate: number }[]
): number {
  if (security.length === 0 && health.length === 0) return 0;
  const secAvg = security.length > 0
    ? security.reduce((sum, s) => sum + s.score, 0) / security.length
    : 0;
  const healthAvg = health.length > 0
    ? health.reduce((sum, h) => sum + h.successRate * 100, 0) / health.length
    : 0;
  if (security.length === 0) return Math.round(healthAvg);
  if (health.length === 0) return Math.round(secAvg);
  return Math.round((secAvg + healthAvg) / 2);
}