'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAutopilotStatus,
  fetchPendingSuggestions,
  fetchLatestDigest,
  generateDigestNow,
  runSecuritySwarm,
  type AutopilotStatus,
  type AggregateMetrics,
  type AuditResponse,
} from '@/lib/guardian-api';
import { HealthReportPanel } from '../reports/HealthReportPanel';
import { ExecutiveOverviewPanel } from '../dashboard/ExecutiveOverviewPanel';
import { FullAnalysisDrawer } from '../FullAnalysisDrawer';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type Props = {
  refreshKey: number;
  metrics: AggregateMetrics | null | undefined;
  audit: AuditResponse | null;
  proxyOnline: boolean | null;
  onReportLoading?: (loading: boolean) => void;
  onAction?: (msg: string) => void;
  onNavigateAdvanced?: (workspace: string, view?: string) => void;
  showAdvancedNav?: boolean;
};

export function ProtectionWorkspace({
  refreshKey,
  metrics,
  audit,
  proxyOnline,
  onReportLoading,
  onAction,
  onNavigateAdvanced,
  showAdvancedNav = true,
}: Props) {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [digestPreview, setDigestPreview] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [busy, setBusy] = useState('');
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const load = useCallback(async () => {
    const [st, dig, pending] = await Promise.all([
      fetchAutopilotStatus(),
      fetchLatestDigest(),
      fetchPendingSuggestions(),
    ]);
    setStatus(st);
    setDigestPreview(dig.healthMarkdown?.slice(0, 400) || '');
    setPendingCount(pending.count);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const onGenerateDigest = async () => {
    setBusy('digest');
    try {
      const res = await generateDigestNow();
      if (res.ok) {
        onAction?.('Digest generated');
        await load();
      } else {
        onAction?.(res.error || 'Digest failed');
      }
    } finally {
      setBusy('');
    }
  };

  const onRunAnalysis = async () => {
    setBusy('swarm');
    try {
      const res = await runSecuritySwarm({ full: false });
      onAction?.(
        res?.ok ? 'Security analysis started' : res?.error || 'Failed to start analysis',
      );
    } finally {
      setBusy('');
    }
  };

  const semanticFlags = audit?.flagged ?? audit?.semanticAudit?.flagged ?? 0;

  return (
    <>
      <section className="briefing-hero">
        <h2>Guardian Autopilot — your MCP protection</h2>
        <p className="briefing-hero-lead">
          Realtime blocking, autonomous threat learning, and scheduled digests. Policy rule changes
          always need your approval.
        </p>
      </section>

      <Card title="Protection status" subtitle="Live Autopilot services">
        {status ? (
          <ul className="insight-callout-list">
            <li>
              Autopilot: <strong>{status.autopilotEnabled ? 'on' : 'off'}</strong> · Scheduler:{' '}
              <strong>{status.scheduler?.running ? 'running' : 'stopped'}</strong>
            </li>
            <li>
              Pending policy suggestions: <strong>{pendingCount}</strong> · Threat research queue:{' '}
              <strong>{status.learning?.threatResearchQueue?.queued ?? 0}</strong>
            </li>
            <li>
              LLM: <strong>{status.llm?.ok ? 'ready' : 'needs setup'}</strong>
              {status.lastDigest?.generatedAt
                ? ` · Last digest: ${new Date(status.lastDigest.generatedAt).toLocaleString()}`
                : ''}
            </li>
            {(status.messages ?? []).map((m) => (
              <li key={m.slice(0, 32)} className="hint">
                {m}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Autopilot status unavailable — ensure proxy is running on port 4000.</p>
        )}
        <div className="btn-row">
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => setAnalysisOpen(true)}>
            Full analysis (plain English)
          </Button>
          <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void onGenerateDigest()}>
            {busy === 'digest' ? 'Generating…' : 'Generate digest now'}
          </Button>
          <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void onRunAnalysis()}>
            {busy === 'swarm' ? 'Starting…' : 'Run full security analysis'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigateAdvanced?.('security', 'ai-copilot')}
          >
            Review suggestions
          </Button>
          {showAdvancedNav ? (
            <Button variant="secondary" size="sm" onClick={() => onNavigateAdvanced?.('threats', 'overview')}>
              Advanced: Threats
            </Button>
          ) : null}
        </div>
        {digestPreview ? (
          <pre className="code-block" style={{ marginTop: 12, maxHeight: 120, overflow: 'auto' }}>
            {digestPreview}
            {digestPreview.length >= 400 ? '…' : ''}
          </pre>
        ) : null}
      </Card>

      <HealthReportPanel proxyOnline={proxyOnline} onReportLoading={onReportLoading} />

      <ExecutiveOverviewPanel
        refreshKey={refreshKey}
        metrics={metrics ?? undefined}
        semanticFlags={semanticFlags}
      />

      <FullAnalysisDrawer
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        proxyOnline={proxyOnline}
      />
    </>
  );
}
