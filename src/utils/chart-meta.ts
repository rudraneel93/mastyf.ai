/**
 * Standard metadata envelope for dashboard chart APIs.
 */
import { parseWindowDays, windowToLabel, type DashboardWindow } from './time-buckets.js';

export type ChartMetaEnvelope = {
  window: DashboardWindow;
  windowDays: number;
  generatedAt: string;
  recordCount: number;
  sparse?: boolean;
  dataSources: string[];
  emptyReason?: string;
};

export function buildChartMeta(opts: {
  windowDays: number;
  recordCount: number;
  sparse?: boolean;
  dataSources: string[];
  emptyReason?: string;
  generatedAt?: string;
}): ChartMetaEnvelope {
  const windowDays = parseWindowDays(opts.windowDays);
  return {
    window: windowToLabel(windowDays),
    windowDays,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    recordCount: opts.recordCount,
    sparse: opts.sparse,
    dataSources: opts.dataSources,
    emptyReason: opts.emptyReason,
  };
}
