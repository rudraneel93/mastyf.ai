'use client';

import { useState } from 'react';
import {
  acceptThreatLabCandidate,
  rejectThreatLabCandidate,
  type ThreatLabCandidate,
} from '@/lib/guardian-api';
import { SOURCE_LABELS } from '@/lib/threat-discovery-copy';
import { ThreatCandidateDrawer } from './ThreatCandidateDrawer';
import { hasPermission } from '@/lib/dashboard-roles';

type Props = {
  candidates: ThreatLabCandidate[];
  roles?: string[];
  manifestMeta?: {
    timestamp?: string;
    mode?: string;
    llmModel?: string;
    llmUsed?: boolean;
  };
  onRefresh?: () => void;
};

export function ThreatLabWorkbench({
  candidates,
  roles,
  manifestMeta,
  onRefresh,
}: Props) {
  const [selected, setSelected] = useState<ThreatLabCandidate | null>(null);
  const canMutate = hasPermission(roles, 'policy_mutate');

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

  return (
    <div className="threat-lab-workbench">
      <p className="hint">
        LLM-proposed fixtures and policy rules — human accept applies rule to live policy.
        {manifestMeta?.mode ? ` Mode: ${manifestMeta.mode}.` : ''}
        {manifestMeta?.llmModel ? ` Model: ${manifestMeta.llmModel}.` : ''}
      </p>
      {candidates.length === 0 ? (
        <p className="muted">No Threat Lab candidates yet. Run Threat Lab from Overview.</p>
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
              {candidates.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{SOURCE_LABELS[c.provenance?.source || ''] || c.provenance?.source || '—'}</td>
                  <td className="cell-truncate" title={c.attackClass}>
                    {c.attackClass.slice(0, 40)}
                    {c.attackClass.length > 40 ? '…' : ''}
                  </td>
                  <td>{(c.confidence * 100).toFixed(0)}%</td>
                  <td>{c.reviewStatus || 'pending'}</td>
                  <td>
                    <button type="button" className="secondary btn-sm" onClick={() => setSelected(c)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
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
        </div>
      )}
    </div>
  );
}
