'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw, Terminal } from 'lucide-react';
import {
  fetchServerRegistry,
  addMcpServer,
  removeMcpServer,
  type ServerRegistryEntry,
  type UiMcpServerConfig,
} from '@/lib/mastyf-ai-api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function LiveMcpServersPanel() {
  const [servers, setServers] = useState<ServerRegistryEntry[]>([]);
  const [uiServers, setUiServers] = useState<UiMcpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', command: '', args: '' });
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { servers: srv, uiServers: ui } = await fetchServerRegistry();
    setServers(srv);
    setUiServers(ui);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.command.trim()) return;
    setSaving(true);
    const args = form.args.split(' ').filter(Boolean);
    const result = await addMcpServer({ name: form.name.trim(), command: form.command.trim(), args });
    setSaving(false);
    if (result.ok) {
      setActionMsg(`Server "${form.name}" added`);
      setForm({ name: '', command: '', args: '' });
      setShowForm(false);
      await load();
    } else {
      setActionMsg(result.error || 'Failed to add server');
    }
  };

  const handleRemove = async (name: string) => {
    const result = await removeMcpServer(name);
    if (result.ok) {
      setActionMsg(`Server "${name}" removed`);
      await load();
    } else {
      setActionMsg(result.error || 'Failed to remove server');
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  if (loading) return <p className="muted">Loading MCP servers…</p>;

  const allServers = [
    ...uiServers.map((u) => ({ name: u.name, command: u.command, transport: 'stdio', wrapped: false, ui: true as const, metrics: undefined })),
    ...servers.filter((s) => !uiServers.find((u) => u.name === s.name)).map((s) => ({ ...s, ui: false as const })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>MCP Servers</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {allServers.length} server{allServers.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh">
            <RefreshCw size={14} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Add Server
          </Button>
        </div>
      </div>

      {actionMsg ? (
        <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 12px' }}>{actionMsg}</p>
      ) : null}

      {error ? <p className="status status-error">{error}</p> : null}

      {allServers.length === 0 && !showForm ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Terminal size={32} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No MCP servers configured</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
              Add a server to start proxying MCP tool calls through Mastyf AI
            </p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Add your first server
            </Button>
          </div>
        </Card>
      ) : null}

      {allServers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allServers.map((s) => (
            <div
              key={s.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <strong style={{ fontSize: 14 }}>{s.name}</strong>
                  {s.ui ? (
                    <Badge tone="live">UI</Badge>
                  ) : (
                    <Badge tone="neutral">Config</Badge>
                  )}
                  {s.metrics?.totalCalls ? (
                    <Badge tone="neutral">{s.metrics.totalCalls.toLocaleString()} calls</Badge>
                  ) : null}
                </div>
                <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {'args' in s && s.args ? `${s.command} ${(s.args as string[]).join(' ')}` : s.command || s.transport}
                </code>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {s.metrics?.totalCalls ? (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                    {s.metrics.blocked > 0 ? `${Math.round((s.metrics.blocked / s.metrics.totalCalls) * 100)}% blocked` : 'All passed'}
                  </span>
                ) : null}
                {s.ui ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(s.name)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-faint)', padding: 4,
                    }}
                    aria-label={`Remove ${s.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-lg)',
              padding: 24, width: '100%', maxWidth: 480,
              boxShadow: 'var(--shadow-md)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Add MCP Server</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Server name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="my-database"
                  style={{
                    padding: '8px 10px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Command
                <input
                  value={form.command}
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                  placeholder="npx, node, uvx, python..."
                  style={{
                    padding: '8px 10px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Arguments
                <input
                  value={form.args}
                  onChange={(e) => setForm({ ...form, args: e.target.value })}
                  placeholder="-y @modelcontextprotocol/server-memory"
                  style={{
                    padding: '8px 10px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', fontSize: 14,
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                variant="primary" size="sm"
                disabled={saving || !form.name.trim() || !form.command.trim()}
                onClick={() => void handleAdd()}
              >
                {saving ? 'Adding…' : 'Add Server'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          <strong>How it works:</strong> Servers added here are saved to{' '}
          <code style={{ fontSize: 12 }}>~/.mastyf-ai/servers.json</code>.
          Restart the proxy to pick up new servers:{' '}
          <code style={{ fontSize: 12 }}>pnpm dev</code> or{' '}
          <code style={{ fontSize: 12 }}>mastyf-ai start</code>.
        </p>
      </Card>
    </div>
  );
}
