'use client';

import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  children: ReactNode;
};

export function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  emptyMessage = 'No data in the selected window — route traffic through the proxy to populate charts.',
  height = 280,
  children,
}: Props) {
  return (
    <article className="chart-card">
      <header className="chart-card-head">
        <h3 className="chart-card-title">{title}</h3>
        {subtitle ? <p className="chart-card-sub">{subtitle}</p> : null}
      </header>
      <div className="chart-card-body" style={{ minHeight: height }}>
        {loading ? <p className="hint chart-card-loading">Loading chart…</p> : null}
        {!loading && empty ? <p className="muted chart-card-empty">{emptyMessage}</p> : null}
        {!loading && !empty ? children : null}
      </div>
    </article>
  );
}
