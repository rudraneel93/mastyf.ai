'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { guardianFetch, resolveApiBase } from '@/lib/guardian-api';
import { DashboardShell } from './DashboardShell';

type Metrics = {
  requests: string;
  blocked: string;
  cost: string;
  instances: string;
};

type LiveEvent = {
  id: string;
  text: string;
  blocked: boolean;
};

const EMPTY_METRICS: Metrics = {
  requests: '—',
  blocked: '—',
  cost: '—',
  instances: '—',
};

export function DashboardClient() {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading…');
  const [statusIsError, setStatusIsError] = useState(false);
  const [apiUnreachable, setApiUnreachable] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const eventSeq = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  const pushEvent = useCallback((text: string, blocked: boolean) => {
    eventSeq.current += 1;
    const id = `ev-${eventSeq.current}`;
    setEvents((prev) => [{ id, text, blocked }, ...prev].slice(0, 80));
  }, []);

  const refreshRest = useCallback(async () => {
    try {
      const [instRes, costRes] = await Promise.all([
        guardianFetch('/api/instances'),
        guardianFetch('/api/cost'),
      ]);

      if (!instRes.ok && !costRes.ok) {
        if (instRes.status === 401 || costRes.status === 401) {
          setStatus('Authentication required — open the dashboard from the proxy or add ?apiKey=');
          setStatusIsError(true);
        } else {
          setStatus(`API unavailable (${instRes.status})`);
          setStatusIsError(true);
        }
        setApiUnreachable(true);
        return;
      }

      setApiUnreachable(false);
      setStatusIsError(false);

      if (instRes.ok) {
        const instances = (await instRes.json()) as Array<{
          totalRequests?: number;
          blockedRequests?: number;
        }>;
        const totalReq = instances.reduce((s, i) => s + (i.totalRequests || 0), 0);
        const totalBlocked = instances.reduce((s, i) => s + (i.blockedRequests || 0), 0);
        setMetrics((m) => ({
          ...m,
          requests: String(totalReq),
          blocked: String(totalBlocked),
          instances: String(instances.length),
        }));
      }

      if (costRes.ok) {
        const cost = (await costRes.json()) as {
          totalCost?: number;
          totalCostUsd?: number;
          totalUsd?: number;
          total?: number;
        };
        const usd =
          cost.totalCostUsd ?? cost.totalCost ?? cost.totalUsd ?? cost.total ?? 0;
        setMetrics((m) => ({ ...m, cost: `$${Number(usd).toFixed(4)}` }));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Network error';
      setStatus(`REST error: ${message}`);
      setStatusIsError(true);
      setApiUnreachable(true);
    }
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    void refreshRest();
    const interval = window.setInterval(() => void refreshRest(), 5000);

    const base = resolveApiBase();
    const wsUrl = (() => {
      try {
        const origin = base || window.location.origin;
        const u = new URL('/ws', origin);
        u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        return u.toString();
      } catch {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${window.location.host}/ws`;
      }
    })();

    function connectWs() {
      wsRef.current?.close();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('WebSocket connected');
        setStatusIsError(false);
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            channels: ['policy', 'health', 'metrics', 'audit', 'ai', 'cost'],
          }),
        );
      };

      ws.onclose = () => {
        setStatus('WebSocket disconnected — retrying…');
        setStatusIsError(false);
        window.setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        setStatus('WebSocket error');
        setStatusIsError(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            channel?: string;
            type?: string;
            action?: string;
            blocked?: boolean;
          };
          const ch = msg.channel || msg.type || 'event';
          const blocked = msg.action === 'block' || msg.blocked === true;
          pushEvent(`[${ch}] ${JSON.stringify(msg).slice(0, 120)}`, blocked);
          if (msg.channel === 'metrics' || msg.type === 'metrics') void refreshRest();
        } catch {
          pushEvent(String(ev.data).slice(0, 120), false);
        }
      };
    }

    connectWs();

    return () => {
      window.clearInterval(interval);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [ready, pushEvent, refreshRest]);

  if (!ready) {
    return <DashboardShell />;
  }

  return (
    <main>
      <header>
        <h1>MCP Guardian</h1>
        <p
          className={statusIsError ? 'status status-error' : 'status'}
          suppressHydrationWarning
        >
          {status}
        </p>
      </header>

      {apiUnreachable && <MotionlessBanner />}

      <section className="cards" aria-label="Metrics">
        <article className="card">
          <h2>Requests</h2>
          <p className="metric" suppressHydrationWarning>
            {metrics.requests}
          </p>
        </article>
        <article className="card">
          <h2>Blocked</h2>
          <p className="metric" suppressHydrationWarning>
            {metrics.blocked}
          </p>
        </article>
        <article className="card">
          <h2>Cost (USD)</h2>
          <p className="metric" suppressHydrationWarning>
            {metrics.cost}
          </p>
        </article>
        <article className="card">
          <h2>Instances</h2>
          <p className="metric" suppressHydrationWarning>
            {metrics.instances}
          </p>
        </article>
      </section>

      <section>
        <h2>Live events</h2>
        <ul className="events">
          {events.length === 0 ? (
            <li className="events-empty">Waiting for events…</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id} className={ev.blocked ? 'blocked' : undefined}>
                {ev.text}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

function MotionlessBanner() {
  return (
    <div className="banner" role="status">
      Guardian API not reachable at this origin. Run the proxy with{' '}
      <code>DASHBOARD_ENABLED=true</code> on port 4000, or add{' '}
      <code>?apiBase=http://localhost:4000</code> (and <code>apiKey=</code> if required).
    </div>
  );
}
