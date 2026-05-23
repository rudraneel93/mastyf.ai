'use client';

type Props = {
  title?: string;
  bullets: string[];
  source: 'measured' | 'llm' | 'deterministic';
  provider?: string;
  model?: string;
  generatedAt?: string;
};

export function InsightCallout({
  title = 'Analyst insights',
  bullets,
  source,
  provider,
  model,
  generatedAt,
}: Props) {
  if (!bullets.length) return null;
  const badge =
    source === 'measured'
      ? 'Measured from proxy'
      : source === 'llm'
        ? `LLM · ${provider || 'local'}${model ? ` · ${model}` : ''}`
        : 'Deterministic summary';

  return (
    <aside className="insight-callout" aria-label={title}>
      <header className="insight-callout-head">
        <h3 className="insight-callout-title">{title}</h3>
        <span className={`insight-callout-badge insight-callout-badge-${source}`}>{badge}</span>
      </header>
      <ul className="insight-callout-list">
        {bullets.map((b) => (
          <li key={b.slice(0, 48)}>{b}</li>
        ))}
      </ul>
      {generatedAt ? <p className="insight-callout-meta">Generated {generatedAt}</p> : null}
    </aside>
  );
}
