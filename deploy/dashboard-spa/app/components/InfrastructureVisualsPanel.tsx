'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchVisualsLive, type VisualsData } from '@/lib/guardian-api';

type TabId = 'traffic' | 'learning' | 'semantic' | 'regression';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#64748b', '#8b5cf6'];

type Props = {
  refreshKey?: number;
  pollMs?: number;
};

export function InfrastructureVisualsPanel({ refreshKey = 0, pollMs = 30_000 }: Props) {
  const [data, setData] = useState<VisualsData | null>(null);
  const [tab, setTab] = useState<TabId>('traffic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const isInitial = data === null;
    if (isInitial) setLoading(true);
    setError('');
    try {
      const result = await fetchVisualsLive();
      if (!result.ok) {
        setData(null);
        setError(result.message);
        return;
      }
      setData(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visuals');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  const hourly = (data?.traffic?.hourly ?? []).map((h) => ({
    label: h.hourStart.slice(5, 16).replace('T', ' '),
    passed: h.passed,
    blocked: h.blocked,
    calls: h.calls,
    p50: h.latencyP50Ms ?? 0,
  }));

  const learningSeries = (data?.instantLearning?.blocksPerMinute ?? []).map((p, i) => ({
    min: Math.round(p.t / 60_000),
    blocks: p.value,
    idx: i,
  }));

  const tools = data?.traffic?.topTools?.slice(0, 8) ?? [];
  const rules = data?.traffic?.topBlockRules?.slice(0, 8) ?? [];
  const servers = data?.traffic?.byServer?.slice(0, 8) ?? [];
  const labelMix = data?.semantic?.labelMix ?? [];
  const confBuckets = data?.semantic?.confidenceBuckets ?? [];
  const userServers = data?.regression?.userServers ?? [];

  return (
    <section className="infra-visuals-panel" aria-label="Infrastructure visuals">
      <div className="infra-visuals-head">
        <h4>Live infrastructure charts</h4>
        <p className="hint">
          Traffic from <code>history.db</code>
          {data?.meta?.dataSources?.semantic === 'semantic-audit-store'
            ? ' · semantic from live audit store'
            : ''}
          {data?.meta?.swarmSessionLive ? ' · regression from session swarm' : ''}
          {data?.instantLearning?.source ? ` · learning: ${data.instantLearning.source}` : ''}
          {data?.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleString()}` : ''}
        </p>
        {!data?.meta?.swarmSessionLive && data?.meta?.emptyReasons?.regression ? (
          <p className="hint live-data-banner">{data.meta.emptyReasons.regression}</p>
        ) : null}
      </div>

      <nav className="infra-visuals-tabs" aria-label="Chart categories">
        {(['traffic', 'learning', 'semantic', 'regression'] as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
          >
            {t === 'traffic' ? 'Traffic' : t === 'learning' ? 'AI learning' : t === 'semantic' ? 'Semantic' : 'Servers'}
          </button>
        ))}
        <button type="button" className="secondary" disabled={loading} onClick={() => void load()}>
          Refresh
        </button>
      </nav>

      {loading && !data ? <p className="hint">Loading charts…</p> : null}
      {error && !data?.traffic?.hasData ? <p className="status status-error">{error}</p> : null}

      {tab === 'traffic' ? (
        <div className="infra-charts-grid">
          <ChartCard title="Calls over time (hourly)" empty={!hourly.length}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passed" stackId="a" fill="#16a34a" name="Passed" />
                <Bar dataKey="blocked" stackId="a" fill="#dc2626" name="Blocked" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Latency p50 by server (ms)" empty={!servers.length}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={servers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="serverName" width={90} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="latencyP50Ms" fill="#2563eb" name="p50 ms" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top tools" empty={!tools.length}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tools}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis dataKey="tool" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Block rules" empty={!rules.length}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rules} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="plainEnglish" width={120} tick={{ fontSize: 8 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}

      {tab === 'learning' ? (
        <div className="infra-charts-grid">
          <ChartCard
            title={`Blocks per minute (${data?.instantLearning?.source ?? 'none'})`}
            empty={!learningSeries.length}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={learningSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis dataKey="min" name="min" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="blocks" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Rule:tool clusters" empty={!(data?.instantLearning?.ruleToolPairs?.length)}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={(data?.instantLearning?.ruleToolPairs ?? []).slice(0, 8).map((p) => ({
                  name: `${p.rule}:${p.tool}`.slice(0, 20),
                  count: p.count,
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 8 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <p className="hint">
            Events: {data?.instantLearning?.totalEvents ?? 0} · Queued suggestions:{' '}
            {data?.instantLearning?.queuedSuggestions ?? 0}
            {data?.meta?.emptyReasons?.instantLearning ? ` · ${data.meta.emptyReasons.instantLearning}` : ''}
          </p>
        </div>
      ) : null}

      {tab === 'semantic' ? (
        <div className="infra-charts-grid">
          {!data?.semantic?.hasData && data?.meta?.emptyReasons?.semantic ? (
            <p className="hint live-data-banner">{data.meta.emptyReasons.semantic}</p>
          ) : null}
          <ChartCard title="Confidence buckets" empty={!confBuckets.length}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={confBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Label mix" empty={!labelMix.length}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={labelMix} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                  {labelMix.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}

      {tab === 'regression' ? (
        <div className="infra-charts-grid">
          <ChartCard title="Your server probes" empty={!userServers.length}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={userServers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
                <XAxis dataKey="serverName" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="toolCount" fill="#16a34a" name="Tools" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <p className="hint">Regression gate PNGs are in the figure gallery below.</p>
        </div>
      ) : null}
    </section>
  );
}

function ChartCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <div className="infra-chart-card">
      <h5>{title}</h5>
      {empty ? <p className="hint">No data in this window yet.</p> : children}
    </div>
  );
}
