'use client';

import type { FleetInstance } from '@/lib/guardian-api';
import { DashboardSection } from './DashboardSection';
import { KpiCard } from './KpiCard';
import { DataTablePro, type Column } from './DataTablePro';

type Props = {
  fleet: FleetInstance[];
};

export function FleetOverviewPanel({ fleet }: Props) {
  const totalRequests = fleet.reduce((s, i) => s + (i.totalRequests ?? 0), 0);
  const totalBlocked = fleet.reduce((s, i) => s + (i.blockedRequests ?? 0), 0);
  const totalCost = fleet.reduce((s, i) => s + (i.totalCostUsd ?? 0), 0);

  const columns: Column<FleetInstance>[] = [
    {
      key: 'instance',
      header: 'Instance',
      render: (r) => r.instanceName || r.instanceId,
      sortValue: (r) => r.instanceName || r.instanceId,
    },
    { key: 'status', header: 'Status', render: (r) => r.status || '—' },
    {
      key: 'requests',
      header: 'Requests',
      render: (r) => r.totalRequests?.toLocaleString() ?? '—',
      sortValue: (r) => r.totalRequests ?? 0,
    },
    {
      key: 'blocked',
      header: 'Blocked',
      render: (r) => r.blockedRequests?.toLocaleString() ?? '—',
      sortValue: (r) => r.blockedRequests ?? 0,
    },
    {
      key: 'cost',
      header: 'Cost (USD)',
      render: (r) => (r.totalCostUsd != null ? `$${r.totalCostUsd.toFixed(4)}` : '—'),
      sortValue: (r) => r.totalCostUsd ?? 0,
    },
    { key: 'source', header: 'Source', render: (r) => r.fleetSource || '—' },
  ];

  return (
    <DashboardSection
      title="Fleet instances"
      subtitle="Guardian process telemetry — Postgres fleet aggregation via CLI for multi-replica"
    >
      <div className="kpi-row">
        <KpiCard label="Instances" value={fleet.length} />
        <KpiCard label="Total requests" value={totalRequests.toLocaleString()} />
        <KpiCard label="Total blocked" value={totalBlocked.toLocaleString()} />
        <KpiCard label="Total cost" value={`$${totalCost.toFixed(4)}`} />
      </div>

      <div className="fleet-card-grid">
        {fleet.map((i) => (
          <article key={i.instanceId} className="kpi-card">
            <p className="kpi-card-label">{i.instanceName || i.instanceId}</p>
            <p className="kpi-card-value">{i.status || 'unknown'}</p>
            <p className="kpi-card-sub">
              {i.totalRequests ?? 0} req · {i.blockedRequests ?? 0} blocked · $
              {(i.totalCostUsd ?? 0).toFixed(4)}
            </p>
          </article>
        ))}
      </div>

      <DataTablePro
        columns={columns}
        rows={fleet}
        rowKey={(r) => r.instanceId}
        exportFilename="guardian-fleet.csv"
      />
    </DashboardSection>
  );
}
