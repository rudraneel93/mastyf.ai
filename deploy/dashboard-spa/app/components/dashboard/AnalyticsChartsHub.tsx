'use client';

import { InfrastructureVisualsPanel } from '../InfrastructureVisualsPanel';
import { DashboardSection } from './DashboardSection';

type Props = {
  refreshKey?: number;
  pollMs?: number;
};

/** Shared analytics chart hub for Overview, Analysis, and Agent flow surfaces. */
export function AnalyticsChartsHub({ refreshKey = 0, pollMs = 30_000 }: Props) {
  return (
    <DashboardSection
      title="Infrastructure analytics"
      subtitle="Traffic, AI learning, semantic audit, and regression probes from live proxy data"
    >
      <InfrastructureVisualsPanel refreshKey={refreshKey} pollMs={pollMs} />
    </DashboardSection>
  );
}

export { InfrastructureVisualsPanel };
