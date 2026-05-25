'use client';

type Tone = 'neutral' | 'live' | 'degraded' | 'offline' | 'success' | 'warn' | 'danger';

type Props = {
  children: React.ReactNode;
  tone?: Tone;
};

export function Badge({ children, tone = 'neutral' }: Props) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}
