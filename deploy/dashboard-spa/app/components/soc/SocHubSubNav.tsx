'use client';

type Tab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
};

export function SocHubSubNav<T extends string>({ tabs, active, onChange, className = '' }: Props<T>) {
  return (
    <nav className={`soc-hub-subnav ${className}`.trim()} aria-label="Section views">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? 'soc-hub-subnav-item active' : 'soc-hub-subnav-item'}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
