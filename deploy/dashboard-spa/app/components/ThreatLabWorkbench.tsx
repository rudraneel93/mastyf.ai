'use client';

import { useEffect, useRef, useState } from 'react';
import {
  acceptThreatLabCandidate,
  rejectThreatLabCandidate,
  runThreatLab,
  type ThreatLabCandidate,
} from '@/lib/guardian-api';
import { SOURCE_LABELS } from '@/lib/threat-discovery-copy';
import { ThreatCandidateDrawer } from './ThreatCandidateDrawer';
import { IncidentInvestigatorDrawer } from './IncidentInvestigatorDrawer';
import { hasPermission } from '@/lib/dashboard-roles';

import type { ThreatLabContext } from './IncidentInvestigatorDrawer';

type Props = {
  candidates: ThreatLabCandidate[];
  roles?: string[];
  preloadedContext?: ThreatLabContext | null;
  manifestMeta?: {
    timestamp?: string;
    mode?: string;
    llmModel?: string;
    llmUsed?: boolean;
  };
  onRefresh?: () => void;
  onClearContext?: () => void;
  onRunStarted?: (msg: string) => void;
};

function findLinkedCandidate(
  candidates: ThreatLabCandidate[],
  ctx: ThreatLabContext,
): ThreatLabCandidate | null {
  return (
    candidates.find(
      (c) =>
        c.provenance?.inputFingerprint === ctx.semanticAuditId
        || (c.provenance?.source === 'semantic-tp' && c.provenance?.inputFingerprint === ctx.semanticAuditId),
    ) ?? null
  );
}

function investigateTriggerId(c: ThreatLabCandidate): string {
  if (c.provenance?.source === 'semantic-tp' && c.provenance?.inputFingerprint) {
    return c.provenance.inputFingerprint;
  }
  return c.provenance?.inputFingerprint || c.id;
}

export function ThreatLabWorkbench({
  candidates,
  roles,
  preloadedContext,
  manifestMeta,
  onRefresh,
  onClearContext,
  onRunStarted,
}: Props) {
  const [selected, setSelected] = useState<ThreatLabCandidate | null>(null);
  const [investigateId, setInvestigateId] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const bannerRef = useRef<HTMLElement>(null);
  const canMutate = hasPermission(roles, 'policy_mutate');
  const canRun = hasPermission(roles, 'policy_test');

  const onAccept = async (id: string) => {
    const ok = await acceptThreatLabCandidate(id);
    if (ok) {
      setSelected(null);
      onRefresh?.();
    }
  };

  const onReject = async (id: string) => {
    const ok = await rejectThreatLabCandidate(id);
    if (ok) {
      setSelected(null);
      onRefresh?.();
    }
  };

  const runThreatLabReactive = async () => {
    if (!canRun || runBusy) return;
    setRunBusy(true);
    try {
      const res = await runThreatLab('reactive');
      if (res.ok) {
        onRunStarted?.('Threat Lab started (reactive)');
        onRefresh?.();
      } else {
        onRunStarted?.(res.error || 'Threat Lab failed to start');
      }
    } finally {
      setRunBusy(false);
    }
  };

  useEffect(() => {
    if (!preloadedContext) return;
    setInvestigateId(preloadedContext.semanticAuditId);
    const linked = findLinkedCandidate(candidates, preloadedContext);
    if (linked) setSelected(linked);
    requestAnimationFrame(() => {
      bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [preloadedContext?.semanticAuditId, candidates]);

  const contextActions = preloadedContext ? (
    <div className="btn-row" style={{ marginTop: 8 }}>
      <button type="button" className="secondary btn-sm" onClick={() => void onRefresh?.()}>
        Refresh candidates
      </button>
      {canRun ? (
        <button
          type="button"
          className="primary btn-sm"
          disabled={runBusy}
          onClick={() => void runThreatLabReactive()}
        >
          {runBusy ? 'Starting…' : 'Run Threat Lab (reactive)'}
        </button>
      ) : null}
      {onClearContext ? (
        <button type="button" className="secondary btn-sm" onClick={onClearContext}>
          Dismiss context
        </button>
      ) : null}
    </div>
  ) : null;

  const investigateDrawer = investigateId ? (
    <IncidentInvestigatorDrawer
      triggerId={investigateId}
      onClose={() => setInvestigateId(null)}
    />
  ) : null;

  return (
    <div className="threat-lab-workbench">
      {preloadedContext ? (
        <aside ref={bannerRef} className="threat-lab-context-banner">
          <strong>Incident context</strong>
          <p>
            Semantic audit <code>{preloadedContext.semanticAuditId}</code> · {preloadedContext.category} ·{' '}
            {preloadedContext.toolName}
          </p>
          {preloadedContext.narrative ? <p className="hint">{preloadedContext.narrative}</p> : null}
          {contextActions}
        </aside>
      ) : null}
      <p className="hint">
        LLM-proposed fixtures and policy rules — human accept applies rule to live policy (blocking).
        {manifestMeta?.mode ? ` Mode: ${manifestMeta.mode}.` : ''}
        {manifestMeta?.llmModel ? ` Model: ${manifestMeta.llmModel}.` : ''}
      </p>
      {candidates.length === 0 ? (
        <>
          {preloadedContext ? (
            <p className="muted">
              No fixture yet for this audit — run Threat Lab (reactive) after labeling a semantic true positive,
              or check the Overview session banner if batch data is hidden.
            </p>
          ) : (
            <p className="muted">No Threat Lab candidates yet. Run Threat Lab from Overview.</p>
          )}
          {investigateDrawer}
          {selected ? (
            <ThreatCandidateDrawer
              candidate={selected}
              onClose={() => setSelected(null)}
              onAccept={(id) => void onAccept(id)}
              onReject={(id) => void onReject(id)}
              canMutate={canMutate}
            />
          ) : null}
        </>
      ) : (
        <div className="workbench-layout">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Source</th>
                <th>Attack class</th>
                <th>Confidence</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const isLinked =
                  preloadedContext != null
                  && c.provenance?.inputFingerprint === preloadedContext.semanticAuditId;
                return (
                  <tr key={c.id} className={isLinked ? 'row-highlight' : undefined}>
                    <td>{c.id}</td>
                    <td>{SOURCE_LABELS[c.provenance?.source || ''] || c.provenance?.source || '—'}</td>
                    <td className="cell-truncate" title={c.attackClass}>
                      {c.attackClass.slice(0, 40)}
                      {c.attackClass.length > 40 ? '…' : ''}
                    </td>
                    <td>{(c.confidence * 100).toFixed(0)}%</td>
                    <td>{c.reviewStatus || 'pending'}</td>
                    <td>
                      <div className="btn-row" style={{ marginTop: 0 }}>
                        <button type="button" className="secondary btn-sm" onClick={() => setSelected(c)}>
                          Details
                        </button>
                        <button
                          type="button"
                          className="secondary btn-sm"
                          onClick={() => {
                            setInvestigateId(investigateTriggerId(c));
                            setSelected(null);
                          }}
                        >
                          Investigate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selected ? (
            <ThreatCandidateDrawer
              candidate={selected}
              onClose={() => setSelected(null)}
              onAccept={(id) => void onAccept(id)}
              onReject={(id) => void onReject(id)}
              canMutate={canMutate}
            />
          ) : null}
          {investigateDrawer}
        </div>
      )}
    </div>
  );
}
