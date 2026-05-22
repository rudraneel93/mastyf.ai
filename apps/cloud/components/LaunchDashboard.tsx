'use client';

import { useState } from 'react';

export function LaunchDashboard() {
  const [guardianUrl, setGuardianUrl] = useState(
    typeof window !== 'undefined'
      ? localStorage.getItem('mcp-guardian-url') ?? 'http://localhost:4000'
      : 'http://localhost:4000',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onLaunch = async () => {
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('mcp-guardian-url', guardianUrl);
      const res = await fetch('/api/dashboard/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianUrl }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error ?? 'Launch failed');
      }
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Open live dashboard</h2>
      <p className="muted">
        Launch your self-hosted Guardian WebSocket ops dashboard with a one-time SSO token. Set{' '}
        <code>GUARDIAN_CONTROL_PLANE_URL</code> and <code>DASHBOARD_JWT_SECRET</code> on your
        Guardian host (see connect instructions above).
      </p>
      <label style={{ display: 'block', marginTop: '1rem' }}>
        Guardian base URL
        <input
          type="url"
          value={guardianUrl}
          onChange={(e) => setGuardianUrl(e.target.value)}
          placeholder="http://localhost:4000"
          style={{
            display: 'block',
            width: '100%',
            marginTop: '0.35rem',
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: '#0a0e13',
            color: 'var(--text)',
          }}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: '1rem' }}
        onClick={() => void onLaunch()}
        disabled={loading}
      >
        {loading ? 'Redirecting…' : 'Open live dashboard'}
      </button>
      {error && <p className="alert alert-warn" style={{ marginTop: '1rem' }}>{error}</p>}
    </div>
  );
}
