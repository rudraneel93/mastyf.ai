'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchCost,
  fetchCostBreakdown,
  fetchCostTimeseries,
  type CostResponse,
} from '@/lib/guardian-api';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_TOOLTIP_STYLE, budgetUtilColor } from '@/lib/chartTheme';
import { DashboardSection } from './DashboardSection';
import { KpiCard } from './KpiCard';
import { ChartCard } from './ChartCard';
import { InsightsNarrativeRail } from './InsightsNarrativeRail';
import { DataTablePro, type Column } from './DataTablePro';

type Props = {
  refreshKey?: number;
  initialCost?: CostResponse | null;
};

type ServerRow = NonNullable<CostResponse['serverReports']>[number];
type ToolRow = { server: string; tool: string; calls: number; costUsd: number };

function pivotTimeseries(
  series: Array<{ bucket: string; server: string; costUsd: number }>,
): Array<Record<string, string | number>> {
  const buckets = new Map<string, Record<string, string | number>>();
  for (const p of series) {
    const label = p.bucket.slice(5, 16).replace('T', ' ');
    const row = buckets.get(p.bucket) || { bucket: label, total: 0 };
    row[p.server] = (Number(row[p.server]) || 0) + p.costUsd;
    row.total = (Number(row.total) || 0) + p.costUsd;
    buckets.set(p.bucket, row);
  }
  return [...buckets.values()];
}

export function CostGovernancePanel({ refreshKey = 0, initialCost = null }: Props) {
  const [cost, setCost] = useState<CostResponse | null>(initialCost);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [timeseries, setTimeseries] = useState<Array<Record<string, string | number>>>([]);
  const [servers, setServers] = useState<string[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(!initialCost);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, b, ts] = await Promise.all([
      fetchCost(),
      fetchCostBreakdown(windowDays),
      fetchCostTimeseries(windowDays, 'day'),
    ]);
    setCost(c);
    setTools(b?.tools || []);
    const series = ts?.series || [];
    setTimeseries(pivotTimeseries(series));
    setServers([...new Set(series.map((s) => s.server))]);
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const budgetPct =
    cost?.budgetUsd && cost.totalCost != null && cost.budgetUsd > 0
      ? Math.min(100, (cost.totalCost / cost.budgetUsd) * 100)
      : null;

  const serverColumns: Column<ServerRow>[] = [
    { key: 'name', header: 'Server', render: (r) => r.name, sortValue: (r) => r.name },
    {
      key: 'cost',
      header: 'Cost (USD)',
      render: (r) => `$${r.cost.toFixed(4)}`,
      sortValue: (r) => r.cost,
    },
    { key: 'tokens', header: 'Tokens', render: (r) => r.tokens.toLocaleString(), sortValue: (r) => r.tokens },
    { key: 'trend', header: 'Trend', render: (r) => r.trend || '—' },
    { key: 'unpriced', header: 'Unpriced', render: (r) => r.unpriced ?? 0, sortValue: (r) => r.unpriced ?? 0 },
  ];

  const toolColumns: Column<ToolRow>[] = [
    { key: 'server', header: 'Server', render: (r) => r.server, sortValue: (r) => r.server },
    { key: 'tool', header: 'Tool', render: (r) => r.tool, sortValue: (r) => r.tool },
    { key: 'calls', header: 'Calls', render: (r) => r.calls, sortValue: (r) => r.calls },
    {
      key: 'costUsd',
      header: 'Cost (USD)',
      render: (r) => `$${r.costUsd.toFixed(4)}`,
      sortValue: (r) => r.costUsd,
    },
  ];

  const toolChartData = useMemo(
    () =>
      tools.slice(0, 10).map((t) => ({
        label: `${t.server}:${t.tool}`.slice(0, 24),
        costUsd: t.costUsd,
      })),
    [tools],
  );

  if (!cost && !loading) {
    return (
      <DashboardSection title="Cost governance" subtitle="Measured spend from proxy call_records">
        <p className="muted">No cost data — connect proxy history DB and route MCP traffic.</p>
      </DashboardSection>
    );
  }

  const utilVariant = budgetPct != null ? budgetUtilColor(budgetPct) : 'default';

  return (
    <div className="cost-governance-panel">
      <InsightsNarrativeRail scope="cost" refreshKey={refreshKey} />

      <DashboardSection
        title="Cost governance"
        subtitle="FinOps view — actual measured spend, not estimates"
        actions={
          <label className="inline">
            Window
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              aria-label="Cost window days"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
        }
      >
        <div className="kpi-row">
          <KpiCard
            label="Total spend"
            value={cost?.totalCost != null ? `$${cost.totalCost.toFixed(4)}` : '—'}
            explanation="Sum of costUsd on intercepted MCP calls with pricing metadata."
          />
          <KpiCard
            label="Burn rate"
            value={cost?.burnRatePerHour != null ? `$${cost.burnRatePerHour.toFixed(4)}` : '—'}
            unit="/hr"
            explanation="Spend divided by observed traffic time span in history DB."
          />
          <KpiCard
            label="Projected monthly"
            value={cost?.projectedMonthly != null ? `$${cost.projectedMonthly.toFixed(2)}` : '—'}
            explanation="Extrapolated from current burn rate over 30 days."
          />
          <KpiCard
            label="Pricing model"
            value={cost?.pricingModel?.split(' ')[0] || '—'}
            sub={cost?.pricingModel}
            explanation="Rate source used for unpriced call enrichment."
          />
        </div>

        {budgetPct != null && cost?.budgetUsd ? (
          <div className="budget-gauge dash-grid-span-12">
            <strong>
              Daily budget: ${cost.budgetUsd.toFixed(2)} ({budgetPct.toFixed(1)}% used)
            </strong>
            <div className="budget-gauge-bar">
              <div
                className={`budget-gauge-fill budget-gauge-fill-${utilVariant}`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
          </div>
        ) : null}

        {(cost?.budgetAlerts || []).map((a) => (
          <p key={a} className="alert">
            {a}
          </p>
        ))}

        <div className="dash-grid">
          <div className="dash-grid-span-8">
            <ChartCard
              title="Spend over time"
              subtitle="Daily cost stacked by MCP server — identifies spikes and drift"
              loading={loading}
              empty={timeseries.length === 0}
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={timeseries}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="bucket" {...CHART_AXIS} />
                  <YAxis {...CHART_AXIS} tickFormatter={(v) => `$${Number(v).toFixed(3)}`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend />
                  {servers.map((srv, i) => (
                    <Area
                      key={srv}
                      type="monotone"
                      dataKey={srv}
                      stackId="1"
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="dash-grid-span-4">
            <ChartCard
              title="Top tools by cost"
              subtitle="Focus optimization on highest USD drivers"
              loading={loading}
              empty={toolChartData.length === 0}
              height={280}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={toolChartData} layout="vertical">
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis type="number" {...CHART_AXIS} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="label" width={100} {...CHART_AXIS} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="costUsd" fill={CHART_COLORS[0]}>
                    {toolChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        <div className="dash-grid">
          <div className="dash-grid-span-6">
            <DashboardSection title="By server" subtitle="Aggregate cost and token volume">
              <DataTablePro
                columns={serverColumns}
                rows={cost?.serverReports || []}
                rowKey={(r) => r.name}
                exportFilename="guardian-cost-by-server.csv"
              />
            </DashboardSection>
          </div>
          <div className="dash-grid-span-6">
            <DashboardSection title="By tool" subtitle={`Top tools in last ${windowDays} days`}>
              <DataTablePro
                columns={toolColumns}
                rows={tools}
                rowKey={(r) => `${r.server}:${r.tool}`}
                exportFilename="guardian-cost-by-tool.csv"
              />
            </DashboardSection>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
