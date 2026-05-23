'use client';

import { useState } from 'react';

export type KpiVariant = 'default' | 'success' | 'warn' | 'danger';

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  delta?: string;
  explanation?: string;
  variant?: KpiVariant;
  sparkline?: React.ReactNode;
};

export function KpiCard({
  label,
  value,
  unit,
  sub,
  delta,
  explanation,
  variant = 'default',
  sparkline,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`kpi-card kpi-card-${variant}`}>
      <div className="kpi-card-head">
        <span className="kpi-card-label">{label}</span>
        {explanation ? (
          <button
            type="button"
            className="kpi-card-info"
            aria-expanded={open}
            aria-label={`Explain ${label}`}
            onClick={() => setOpen((v) => !v)}
          >
            ?
          </button>
        ) : null}
      </div>
      <p className="kpi-card-value">
        {value}
        {unit ? <span className="kpi-card-unit">{unit}</span> : null}
      </p>
      {delta ? <p className="kpi-card-delta">{delta}</p> : null}
      {sub ? <p className="kpi-card-sub">{sub}</p> : null}
      {sparkline ? <div className="kpi-card-spark">{sparkline}</div> : null}
      {open && explanation ? <p className="kpi-card-detail">{explanation}</p> : null}
    </article>
  );
}
