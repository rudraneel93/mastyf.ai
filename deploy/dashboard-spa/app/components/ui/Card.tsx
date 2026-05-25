'use client';

import type { ReactNode, CSSProperties } from 'react';

type Props = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Card({ title, subtitle, actions, children, className = '', style }: Props) {
  return (
    <section className={`ui-card ${className}`.trim()} style={style}>
      {title ? (
        <header className="ui-card-head">
          <div>
            <h3 className="ui-card-title">{title}</h3>
            {subtitle ? <p className="ui-card-sub">{subtitle}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="ui-card-body">{children}</div>
    </section>
  );
}
