'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  acceptSuggestion,
  fetchAiBaselines,
  fetchAiReport,
  fetchAiState,
  fetchAiSuggestions,
  fetchAiThreats,
  fetchSemanticOutcomes,
  labelSemanticOutcome,
  rejectSuggestion,
  rollbackAiLearning,
  type AiSuggestion,
  type SemanticOutcome,
} from '@/lib/guardian-api';
import { hasPermission } from '@/lib/dashboard-roles';

type Props = {
  roles?: string[];
  refreshTick?: number;
  onAction?: (msg: string) => void;
};

export function AiLearningPanel({ roles, refreshTick = 0, onAction }: Props) {
  const canAi = hasPermission(roles, 'ai');
  const canMutate = hasPermission(roles, 'policy_mutate');
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [semantic, setSemantic] = useState<SemanticOutcome[]>([]);
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [baselines, setBaselines] = useState<unknown[]>([]);
  const [threats, setThreats] = useState<{ threats: number } | null>(null);
  const [reportSnippet, setReportSnippet] = useState('');

  const refresh = useCallback(async () => {
    const [sug, sem, st, base, thr, rep] = await Promise.all([
      fetchAiSuggestions(),
      fetchSemanticOutcomes(),
      fetchAiState(),
      fetchAiBaselines(),
      fetchAiThreats(),
      fetchAiReport(),
    ]);
    setSuggestions(sug);
    setSemantic(sem);
    setState(st);
    setBaselines(base);
    setThreats(thr);
    const snippet = rep?.report ? JSON.stringify(rep.report, null, 2).slice(0, 1500) : '';
    setReportSnippet(snippet);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (refreshTick <= 0) return;
    const t = window.setTimeout(() => void refresh(), 500);
    return () => window.clearTimeout(t);
  }, [refreshTick, refresh]);

  const onAccept = async (s: AiSuggestion) => {
    if (!canMutate) {
      onAction?.('Requires operator role');
      return;
    }
    const ok = await acceptSuggestion(s);
    onAction?.(ok ? `Accepted ${s.ruleName || s.id}` : 'Accept failed');
    if (ok) await refresh();
  };

  const onReject = async (s: AiSuggestion) => {
    if (!canMutate) {
      onAction?.('Requires operator role');
      return;
    }
    const ok = await rejectSuggestion(s);
    onAction?.(ok ? `Rejected ${s.ruleName || s.id}` : 'Reject failed');
    if (ok) await refresh();
  };

  const onLabel = async (id: string, label: 'true_positive' | 'false_positive' | 'ignored') => {
    if (!canAi) {
      onAction?.('Requires admin/ai role');
      return;
    }
    const res = await labelSemanticOutcome({ semanticAuditId: id, label });
    onAction?.(res.ok ? `Labeled ${id} as ${label}` : res.error || 'Label failed');
    if (res.ok) await refresh();
  };

  const onRollback = async () => {
    if (!canAi) {
      onAction?.('Requires admin/ai role');
      return;
    }
    if (!window.confirm('Rollback AI learning snapshots?')) return;
    const res = await rollbackAiLearning();
    onAction?.(res.ok ? 'AI learning rolled back' : res.error || 'Rollback failed');
    if (res.ok) await refresh();
  };

  return (
    <section>
      <h2>AI learning &amp; semantic audit</h2>
      <p className="hint">Accept/reject suggestions, label semantic outcomes, rollback learning state.</p>

      <div className="btn-row">
        <button type="button" className="secondary" onClick={() => void refresh()}>
          Refresh
        </button>
        {canAi ? (
          <button type="button" className="secondary" onClick={() => void onRollback()}>
            Rollback AI snapshots
          </button>
        ) : null}
      </div>

      {state ? (
        <div className="cards">
          <article className="card">
            <h3>Engine state</h3>
            <p className="metric-inline">
              TP rate: {String(state.truePositiveRate ?? '—')} · FP rate:{' '}
              {String(state.falsePositiveRate ?? '—')}
            </p>
            <p className="muted">Threshold: {String(state.adaptiveThreshold ?? '—')}</p>
          </article>
          <article className="card">
            <h3>Threat intel</h3>
            <p className="metric">{threats?.threats ?? 0} known IDs</p>
          </article>
          <article className="card">
            <h3>Baselines</h3>
            <p className="metric">{baselines.length}</p>
          </article>
        </div>
      ) : null}

      <h3>Pending suggestions</h3>
      {suggestions.length === 0 ? (
        <p className="muted">No pending suggestions.</p>
      ) : (
        <ul className="suggestions">
          {suggestions.map((s) => (
            <li key={String(s.id || s.ruleName)}>
              <strong>{s.ruleName || s.id}</strong>
              <span className="muted">
                {' '}
                ({s.source}, {(s.confidence ?? 0) * 100}%)
              </span>
              <p>{s.reason}</p>
              <div className="btn-row">
                <button type="button" disabled={!canMutate} onClick={() => void onAccept(s)}>
                  Accept
                </button>
                <button type="button" className="secondary" disabled={!canMutate} onClick={() => void onReject(s)}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Semantic audit outcomes</h3>
      {semantic.length === 0 ? (
        <p className="muted">No semantic audit records (enable GUARDIAN_SEMANTIC_ASYNC).</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Rule</th>
              <th>Label</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {semantic.slice(0, 30).map((r) => (
              <tr key={r.id}>
                <td>{r.toolName || '—'}</td>
                <td>{r.ruleName || '—'}</td>
                <td>{r.label || '—'}</td>
                <td>
                  {canAi ? (
                    <span className="btn-row inline">
                      <button type="button" className="secondary" onClick={() => void onLabel(r.id, 'true_positive')}>
                        TP
                      </button>
                      <button type="button" className="secondary" onClick={() => void onLabel(r.id, 'false_positive')}>
                        FP
                      </button>
                      <button type="button" className="secondary" onClick={() => void onLabel(r.id, 'ignored')}>
                        Ignore
                      </button>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportSnippet ? (
        <>
          <h3>AI report (excerpt)</h3>
          <pre className="code-block">{reportSnippet}</pre>
        </>
      ) : null}
    </section>
  );
}
