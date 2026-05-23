/** Shared Recharts styling for enterprise dashboard panels. */

export const CHART_COLORS = [
  '#38bdf8',
  '#22c55e',
  '#f87171',
  '#fbbf24',
  '#a78bfa',
  '#64748b',
  '#2dd4bf',
  '#fb923c',
] as const;

export const CHART_GRID = { stroke: '#334155', strokeDasharray: '3 3' };
export const CHART_AXIS = { stroke: '#64748b', fontSize: 11, tickLine: false };
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #475569',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
};

export function severityColor(score: number | null | undefined): string {
  if (score == null) return CHART_COLORS[5];
  if (score >= 80) return CHART_COLORS[1];
  if (score >= 60) return CHART_COLORS[3];
  return CHART_COLORS[2];
}

export function budgetUtilColor(pct: number): 'success' | 'warn' | 'danger' {
  if (pct >= 100) return 'danger';
  if (pct >= 75) return 'warn';
  return 'success';
}
