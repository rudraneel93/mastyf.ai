'use client';

import { Badge } from './Badge';

type Props = {
  kind: 'snapshot' | 'live';
  detail?: string;
};

export function DataProvenanceBanner({ kind, detail }: Props) {
  const tone = kind === 'live' ? 'live' : 'neutral';
  const label = kind === 'live' ? 'Live proxy data' : 'Reference snapshot · not live';
  return (
    <div className="provenance-banner" role="status">
      <Badge tone={tone}>{label}</Badge>
      {detail ? <span className="provenance-detail">{detail}</span> : null}
    </div>
  );
}
