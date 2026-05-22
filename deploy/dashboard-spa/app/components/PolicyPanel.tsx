'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchPolicy,
  reloadPolicy,
  testPolicy,
  type PolicyInfo,
} from '@/lib/guardian-api';
import { hasPermission } from '@/lib/dashboard-roles';

type Props = {
  roles?: string[];
  lastBlocked?: { tool_name: string; server_name: string; reason: string | null } | null;
  onAction?: (msg: string) => void;
};

export function PolicyPanel({ roles, lastBlocked, onAction }: Props) {
  const canTest = hasPermission(roles, 'policy_test');
  const canMutate = hasPermission(roles, 'policy_mutate');
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [testResult, setTestResult] = useState('');
  const [testTool, setTestTool] = useState('');
  const [testArgs, setTestArgs] = useState('{"query": "test"}');

  const refresh = useCallback(async () => {
    setPolicy(await fetchPolicy());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runTest = async () => {
    if (!canTest) {
      onAction?.('Requires operator role');
      return;
    }
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(testArgs) as Record<string, unknown>;
    } catch {
      setTestResult('Invalid JSON in arguments');
      return;
    }
    const result = await testPolicy({
      tool: testTool || lastBlocked?.tool_name || 'read_file',
      arguments: args,
      server: lastBlocked?.server_name,
    });
    setTestResult(result ? JSON.stringify(result, null, 2) : 'Policy test failed');
  };

  const onReload = async () => {
    if (!canMutate) {
      onAction?.('Requires operator role');
      return;
    }
    const ok = await reloadPolicy();
    onAction?.(ok ? 'Policy reload signaled' : 'Reload failed');
    if (ok) await refresh();
  };

  return (
    <section>
      <h2>Policy studio</h2>
      <p className="hint">
        Mode: <strong>{policy?.mode ?? '—'}</strong>
        {policy?.path ? (
          <>
            {' '}
            · <code>{policy.path}</code>
          </>
        ) : null}
      </p>

      <div className="btn-row">
        <button type="button" disabled={!canMutate} onClick={() => void onReload()}>
          Reload policy watcher
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!canTest}
          onClick={() => {
            if (lastBlocked) {
              setTestTool(lastBlocked.tool_name);
              setTestArgs(JSON.stringify({ query: lastBlocked.reason || 'test' }));
            }
            void runTest();
          }}
        >
          Test last blocked call
        </button>
      </div>

      <label className="policy-field">
        Tool name
        <input value={testTool} onChange={(e) => setTestTool(e.target.value)} placeholder="read_file" />
      </label>
      <label className="policy-field">
        Arguments (JSON)
        <textarea
          className="policy-yaml"
          rows={3}
          value={testArgs}
          onChange={(e) => setTestArgs(e.target.value)}
        />
      </label>
      <button type="button" className="secondary" disabled={!canTest} onClick={() => void runTest()}>
        Run policy test
      </button>

      {policy?.yaml ? (
        <>
          <h3>Active policy YAML</h3>
          <textarea className="policy-yaml" readOnly rows={18} value={policy.yaml} />
        </>
      ) : (
        <p className="muted">No policy file loaded on proxy (start with --policy).</p>
      )}

      {testResult ? <pre className="code-block">{testResult}</pre> : null}
    </section>
  );
}
