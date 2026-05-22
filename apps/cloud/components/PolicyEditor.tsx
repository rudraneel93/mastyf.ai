'use client';

import { useEffect, useState } from 'react';

export function PolicyEditor({ initialYaml }: { initialYaml: string }) {
  const [yaml, setYaml] = useState(initialYaml);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setYaml(initialYaml);
  }, [initialYaml]);

  const onSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const res = await fetch('/api/dashboard/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Save failed');
      }
      setStatus('Saved');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDownload = () => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'policy.yaml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <h2>Policy YAML</h2>
      <p className="muted">
        Edit your tenant policy. Deploy to{' '}
        <code>policy-templates/tenants/&lt;tenant-id&gt;/policy.yaml</code> on your Guardian
        host, or pull via <code>/api/v1/policy</code>.
      </p>
      <textarea
        className="policy-editor"
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        spellCheck={false}
      />
      <div className="actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={onDownload}>
          Download
        </button>
      </div>
      {status && <p className={status === 'Saved' ? 'alert-success alert' : 'alert-warn alert'}>{status}</p>}
    </div>
  );
}
