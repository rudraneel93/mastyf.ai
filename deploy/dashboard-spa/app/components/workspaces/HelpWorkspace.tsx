'use client';

import { useMemo, useState } from 'react';
import { HELP_TOPICS, findHelpTopic, type HelpTopic } from '@/lib/dashboard-help-content';

type Props = {
  initialTopic?: string;
};

function HelpArticle({ topic }: { topic: HelpTopic }) {
  return (
    <article className="help-article">
      <p className="hint">{topic.category}</p>
      <h3>{topic.title}</h3>
      <h4>What it is</h4>
      <p>{topic.what}</p>
      <h4>How to trigger</h4>
      <ul>
        {topic.trigger.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <h4>Data sources</h4>
      <ul>
        {topic.dataSources.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <h4>Outputs</h4>
      <ul>
        {topic.outputs.map((o) => (
          <li key={o}>
            <code>{o}</code>
          </li>
        ))}
      </ul>
      <h4>APIs</h4>
      <ul>
        {topic.apis.map((a) => (
          <li key={a}>
            <code>{a}</code>
          </li>
        ))}
      </ul>
      {topic.rbac ? (
        <>
          <h4>Permissions</h4>
          <p>{topic.rbac}</p>
        </>
      ) : null}
    </article>
  );
}

export function HelpWorkspace({ initialTopic }: Props) {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(initialTopic ?? HELP_TOPICS[0]?.id ?? '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_TOPICS;
    return HELP_TOPICS.filter(
      (t) =>
        t.title.toLowerCase().includes(q)
        || t.category.toLowerCase().includes(q)
        || t.what.toLowerCase().includes(q),
    );
  }, [query]);

  const active = findHelpTopic(activeId) ?? filtered[0];

  return (
    <div className="help-workspace">
      <h2>Help</h2>
      <p className="briefing-hero-lead">
        How each dashboard feature works, what data it uses, and how to run it. All panels use live proxy
        APIs unless an explicit empty state is shown.
      </p>
      <input
        type="search"
        className="help-search"
        placeholder="Search topics…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search help topics"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 24 }}>
        <ul className="help-topic-list">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={activeId === t.id ? 'tab active' : ''}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setActiveId(t.id)}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
        {active ? <HelpArticle topic={active} /> : <p className="muted">No matching topics.</p>}
      </div>
    </div>
  );
}
