'use client';

import type { DashboardWindow } from '../dashboard/DashboardWindowContext';

const VIDEO_WINDOWS: DashboardWindow[] = ['1h', '24h', '7d', '30d'];

type Props = {
  value: DashboardWindow;
  onChange: (w: DashboardWindow) => void;
};

export function WindowSegmentedControl({ value, onChange }: Props) {
  return (
    <div className="window-segmented" role="group" aria-label="Time window">
      {VIDEO_WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          className={value === w ? 'window-segmented-btn active' : 'window-segmented-btn'}
          onClick={() => onChange(w)}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
