'use client';

import type { ReactNode, CSSProperties } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const spark = data.map((v, i) => ({ i, v }));
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function SocCard({
  title,
  sub,
  icon,
  children,
  style,
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="soc-card" style={style}>
      <div className="soc-card-header">
        <div className="soc-card-title">
          {icon}
          {title}
        </div>
        {sub ? <span className="soc-card-sub">{sub}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function SocSectionHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="section-header mb-20">
      {icon}
      <div>
        <div className="section-title">{title}</div>
        <div className="section-sub">{subtitle}</div>
      </div>
      {actions}
    </div>
  );
}
