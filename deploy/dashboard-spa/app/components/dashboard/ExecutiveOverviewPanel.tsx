'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchAggregateMetrics,
  fetchExecutiveSummary,
  fetchVisualsLive,
  type AggregateMetrics,
  type ExecutiveSummaryResponse,
  type VisualsData,
} from '@/lib/guardian-api';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_TOOLTIP_STYLE } from '@/lib/chartTheme';
import { DashboardSection } from './DashboardSection';
import { KpiCard } from './KpiCard';
import { ChartCard } from './ChartCard';
import { InsightsNarrativeRail } from './InsightsNarrativeRail';

type Props = {
  refreshKey?: number;
  metrics?: AggregateMetrics | null;
  semanticFlags?: number;
};

export function ExecutiveOverviewPanel({ refreshKey = 0, metrics: metricsProp, semanticFlags = 0 }: Props) {
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(metricsProp ?? null);
  const [summary, setSummary] = useState<ExecutiveSummaryResponse | null>(null);
  const [visuals, setVisuals] = useState<VisualsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, s, v] = await Promise.all([
      metricsProp ? Promise.resolve(metricsProp) : fetchAggregateMetrics(),
      fetchExecutiveSummary(),
      fetchVisualsLive(),
    ]);
    if (!metricsProp) setMetrics(m);
    setSummary(s);
    setVisuals(v.ok ? v.data : null);
    setLoading(false);
  }, [metricsProp]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (metricsProp) setMetrics(metricsProp);
  }, [metricsProp]);

  const hourly = (visuals?.traffic?.hourly ?? []).map((h) => ({
    label: h.hourStart.slice(5, 16).replace('T', ' '),
    passed: h.passed,
    blocked: h.blocked,
  }));

  const costByServer = (visuals?.traffic?.byServer ?? [])
    .filter((s) => (s.costUsd ?? 0) > 0)
    .map((s) => ({ name: s.serverName, costUsd: s.costUsd ?? 0 }));

  const ruleData = (visuals?.traffic?.topBlockRules ?? []).slice(0, 8).map((r) => ({
    name: r.rule.slice(0, 20),
    count: r.count,
  }));

  const passRate =
    summary?.passRatePct ??
    metrics?.passRate ??
    (metrics && metrics.totalRequests
      ? ((metrics.passedRequests ?? 0) / metrics.totalRequests) * 100
      : null);

  return (
    <div className="executive-overview-panel">
      <InsightsNarrativeRail scope="overview" refreshKey={refreshKey} />

      <DashboardSection
        title="Executive overview"
        subtitle="Operational posture at a glance — all metrics from live proxy history"
        lastUpdated={summary?.timestamp?.slice(0, 19) || metrics?.lastUpdated}
      >
        <div className="kpi-row">
          <KpiCard
            label="Total calls"
            value={(summary?.totalRequests ?? metrics?.totalRequests ?? 0).toLocaleString()}
            explanation="Intercepted MCP tool invocations recorded in history.db."
          />
          <KpiCard
            label="Pass rate"
            value={passRate != null ? `${passRate.toFixed(1)}%` : '—'}
            variant={passRate != null && passRate < 90 ? 'warn' : 'success'}
            explanation="Percentage of calls allowed by policy (non-block)."
          />
          <KpiCard
            label="Block rate"
            value={summary?.blockRatePct != null ? `${summary.blockRatePct}%` : '—'}
            variant={summary?.blockRatePct != null && summary.blockRatePct > 15 ? 'warn' : 'default'}
            explanation="Policy/DLP blocks — high rates may indicate attack traffic or tight rules."
          />
          <KpiCard
            label="Avg latency"
            value={
              summary?.avgLatencyMs ?? metrics?.avgLatencyMs
                ? `${Math.round(summary?.avgLatencyMs ?? metrics?.avgLatencyMs ?? 0)} ms`
                : '—'
            }
            explanation="Mean proxy evaluation + upstream latency per call."
          />
          <KpiCard
            label="Total cost"
            value={
              summary?.totalCostUsd != null
                ? `$${summary.totalCostUsd.toFixed(4)}`
                : metrics?.totalCost != null
                  ? `$${metrics.totalCost.toFixed(4)}`
                  : '—'
            }
            explanation="Measured USD from priced MCP calls."
          />
          <KpiCard
            label="Burn / hr"
            value={
              summary?.burnRatePerHour != null
                ? `$${summary.burnRatePerHour.toFixed(4)}`
                : metrics?.burnRatePerHour != null
                  ? `$${metrics.burnRatePerHour.toFixed(4)}`
                  : '—'
            }
            explanation="Current hourly spend velocity."
          />
          <KpiCard
            label="Semantic flags"
            value={semanticFlags}
            variant={semanticFlags > 0 ? 'warn' : 'default'}
            explanation="Async tier-2 LLM semantic audit flags awaiting review."
          />
          <KpiCard
            label="Active servers"
            value={summary?.activeServers ?? metrics?.activeServers ?? '—'}
            explanation="Distinct MCP servers with traffic in the current window."
          />
        </div>

        <div className="dash-grid">
          <div className="dash-grid-span-8">
            <ChartCard
              title="Traffic volume"
              subtitle="Hourly pass vs block — sudden block spikes often correlate with attacks"
              loading={loading}
              empty={hourly.length === 0}
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={hourly}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="label" {...CHART_AXIS} />
                  <YAxis {...CHART_AXIS} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend />
                  <Area type="monotone" dataKey="passed" stackId="1" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.6} name="Passed" />
                  <Area type="monotone" dataKey="blocked" stackId="1" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.6} name="Blocked" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="dash-grid-span-4">
            <ChartCard
              title="Block rules"
              subtitle="Which policy rules fire most often"
              loading={loading}
              empty={ruleData.length === 0}
            >
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={ruleData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {ruleData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="dash-grid-span-6">
            <ChartCard
              title="Cost by server"
              subtitle="Where MCP spend concentrates"
              loading={loading}
              empty={costByServer.length === 0}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={costByServer}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="name" {...CHART_AXIS} />
                  <YAxis {...CHART_AXIS} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="costUsd" fill={CHART_COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="dash-grid-span-6">
            <ChartCard
              title="Top tools"
              subtitle="Highest call volume — baseline for anomaly detection"
              loading={loading}
              empty={(summary?.topToolsByCalls?.length ?? 0) === 0}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={summary?.topToolsByCalls?.slice(0, 8) ?? []}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="tool" {...CHART_AXIS} />
                  <YAxis {...CHART_AXIS} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="calls" fill={CHART_COLORS[4]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
