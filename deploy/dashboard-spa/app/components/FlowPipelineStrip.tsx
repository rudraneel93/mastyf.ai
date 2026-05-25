'use client';

import { SWARM_PIPELINE_PHASES, type PipelineState } from '@/lib/flow-types';

type Props = {
  pipeline: PipelineState;
  logTail?: string;
};

export function FlowPipelineStrip({ pipeline, logTail }: Props) {
  const activeIdx = (() => {
    if (pipeline.activeIndex >= 0) return pipeline.activeIndex;
    if (pipeline.activePhaseId) {
      const i = SWARM_PIPELINE_PHASES.findIndex((p) => p.id === pipeline.activePhaseId);
      if (i >= 0) return i;
    }
    if (pipeline.state === 'running') return 0;
    if (pipeline.state === 'done') return SWARM_PIPELINE_PHASES.length - 1;
    return -1;
  })();

  const doneCount =
    pipeline.state === 'done'
      ? SWARM_PIPELINE_PHASES.length
      : pipeline.state === 'running' && activeIdx >= 0
        ? activeIdx
        : 0;

  return (
    <div className="pipeline-strip" aria-label="Security analysis pipeline" role="list">
      <span className="pipeline-progress-count" aria-live="polite">
        {pipeline.state === 'idle'
          ? 'Ready'
          : pipeline.state === 'done'
            ? `${SWARM_PIPELINE_PHASES.length}/${SWARM_PIPELINE_PHASES.length} complete`
            : pipeline.state === 'failed'
              ? `Failed at step ${activeIdx + 1}/${SWARM_PIPELINE_PHASES.length}`
              : `${doneCount}/${SWARM_PIPELINE_PHASES.length}`}
      </span>
      {SWARM_PIPELINE_PHASES.map((phase, i) => {
        let stateClass = 'pending';
        if (pipeline.state === 'failed' && i === activeIdx) stateClass = 'failed';
        else if (pipeline.state === 'done' || i < activeIdx) stateClass = 'done';
        else if (i === activeIdx && pipeline.state === 'running') stateClass = 'active';

        return (
          <div
            key={phase.id}
            className={`pipeline-step ${stateClass}`}
            role="listitem"
            aria-current={i === activeIdx && pipeline.state === 'running' ? 'step' : undefined}
          >
            <span className="pipeline-dot" aria-hidden />
            <span className="pipeline-label">{phase.label}</span>
          </div>
        );
      })}
      {pipeline.state === 'running' && pipeline.phaseLabel ? (
        <p className="hint pipeline-active-hint">
          Active: {pipeline.phaseLabel}
          {pipeline.progressPct != null ? ` (${pipeline.progressPct}%)` : ''}
        </p>
      ) : null}
      {pipeline.state === 'running' && logTail ? (
        <pre className="pipeline-log-tail" aria-label="Latest log lines">
          {logTail.split('\n').slice(-4).join('\n')}
        </pre>
      ) : null}
      {pipeline.state === 'failed' && pipeline.error ? (
        <p className="status status-error pipeline-active-hint">{pipeline.error}</p>
      ) : null}
    </div>
  );
}
