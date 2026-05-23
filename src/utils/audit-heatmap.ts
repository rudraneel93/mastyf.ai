/**
 * Audit block heatmap aggregation (rule × tool).
 */
import type { ProxyCallRecord } from '../types.js';

export type AuditHeatmapCell = {
  rule: string;
  tool: string;
  count: number;
};

export function buildAuditHeatmap(
  records: ProxyCallRecord[],
  maxCells = 100,
): AuditHeatmapCell[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.blocked) continue;
    const rule = r.blockRule || 'unknown';
    const tool = r.toolName || 'unknown';
    const key = `${rule}\0${tool}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => {
      const [rule, tool] = key.split('\0');
      return { rule, tool, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, maxCells);
}
