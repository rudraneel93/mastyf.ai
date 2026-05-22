/**
 * Dashboard-triggered security swarm analysis (detached background job).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { broadcastDashboardEvent } from './dashboard-events.js';
import { emitFlowStep } from './flow-events.js';
import { REPO_ROOT, SWARM_DIR } from './swarm-artifacts.js';

const JOB_PATH = join(REPO_ROOT, 'reports', 'security-swarm', 'job.json');
const ANALYSIS_PATH = join(REPO_ROOT, 'reports', 'security-swarm', 'analysis.txt');
const RUN_SCRIPT = join(REPO_ROOT, 'security-swarm', 'run-analysis.mjs');

export interface SwarmJobStatus {
  jobId: string;
  state: 'idle' | 'running' | 'done' | 'failed';
  phase: string;
  phaseLabel: string;
  progressPct: number;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  error: string | null;
  analysisPath: string;
  logTail: string;
}

function loadJobFile(): Record<string, unknown> | null {
  if (!existsSync(JOB_PATH)) return null;
  try {
    return JSON.parse(readFileSync(JOB_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readLogTail(maxLines = 50): string {
  const logPath = join(REPO_ROOT, 'reports', 'security-swarm', 'job.log');
  if (!existsSync(logPath)) return '';
  const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

export function getSwarmJobStatus(): SwarmJobStatus {
  const job = loadJobFile();
  return {
    jobId: String(job?.jobId ?? ''),
    state: (job?.state as SwarmJobStatus['state']) || 'idle',
    phase: String(job?.phase ?? ''),
    phaseLabel: String(job?.phaseLabel ?? ''),
    progressPct: Number(job?.progressPct ?? 0),
    startedAt: job?.startedAt ? String(job.startedAt) : null,
    finishedAt: job?.finishedAt ? String(job.finishedAt) : null,
    exitCode: job?.exitCode != null ? Number(job.exitCode) : null,
    error: job?.error ? String(job.error) : null,
    analysisPath: ANALYSIS_PATH,
    logTail: readLogTail(),
  };
}

export function isSwarmJobRunning(): boolean {
  const job = loadJobFile();
  return job?.state === 'running';
}

let jobWatchTimer: ReturnType<typeof setInterval> | null = null;
let lastBroadcastPhase = '';
let lastBroadcastState = '';
const artifactMtime = new Map<string, number>();

const WATCHED_ARTIFACTS = [
  'report.json',
  'traffic-summary.json',
  'user-servers-session.json',
  'visuals-data.json',
  'figures/manifest.json',
  'latest.json',
  'analysis.txt',
];

function checkIncrementalArtifacts(): void {
  for (const name of WATCHED_ARTIFACTS) {
    const p = name.includes('/') ? join(REPO_ROOT, 'reports', 'security-swarm', name) : join(SWARM_DIR, name);
    if (!existsSync(p)) continue;
    try {
      const m = statSync(p).mtimeMs;
      if (artifactMtime.get(name) === m) continue;
      artifactMtime.set(name, m);
      broadcastDashboardEvent({
        type: 'analysis:artifact',
        payload: { paths: [name], partial: true },
        timestamp: Date.now(),
      });
    } catch {
      /* ignore */
    }
  }
}

function broadcastSwarmJob(job: Record<string, unknown> | null): void {
  if (!job) return;
  const state = String(job.state ?? 'idle');
  const phase = String(job.phase ?? '');
  const phaseLabel = String(job.phaseLabel ?? phase);
  const progressPct = Number(job.progressPct ?? 0);

  if (state === 'running' && phase && phase !== lastBroadcastPhase) {
    lastBroadcastPhase = phase;
    broadcastDashboardEvent({
      type: 'swarm:progress',
      payload: { phase, phaseLabel, progressPct, jobId: job.jobId },
      timestamp: Date.now(),
    });
    emitFlowStep({
      kind: 'swarm_phase',
      title: phaseLabel,
      summary: `Security analysis ${progressPct}%`,
      severity: 'info',
      metadata: { phase, progressPct },
    });
  }

  if (state !== lastBroadcastState && (state === 'done' || state === 'failed')) {
    lastBroadcastState = state;
    stopSwarmJobWatcher();
    if (state === 'done') {
      broadcastDashboardEvent({
        type: 'swarm:done',
        payload: { jobId: job.jobId, analysisPath: ANALYSIS_PATH },
        timestamp: Date.now(),
      });
      emitFlowStep({
        kind: 'swarm_done',
        title: 'Security analysis complete',
        summary: 'analysis.txt and gate artifacts ready',
        severity: 'success',
      });
      broadcastDashboardEvent({
        type: 'analysis:artifact',
        payload: {
          paths: [
            'report.json',
            'traffic-summary.json',
            'user-servers-session.json',
            'visuals-data.json',
            'figures/manifest.json',
            'analysis.txt',
            'latest.json',
            'summary.md',
          ],
        },
        timestamp: Date.now(),
      });
    } else {
      broadcastDashboardEvent({
        type: 'swarm:failed',
        payload: { error: job.error, jobId: job.jobId },
        timestamp: Date.now(),
      });
      emitFlowStep({
        kind: 'swarm_failed',
        title: 'Security analysis failed',
        summary: String(job.error || 'Unknown error'),
        severity: 'error',
      });
    }
  }
}

function tickSwarmJobWatcher(): void {
  const job = loadJobFile();
  if (!job || job.state !== 'running') {
    if (job) broadcastSwarmJob(job);
    if (!job || job.state !== 'running') stopSwarmJobWatcher();
    return;
  }
  broadcastSwarmJob(job);
  checkIncrementalArtifacts();
}

export function startSwarmJobWatcher(): void {
  if (jobWatchTimer) {
    clearInterval(jobWatchTimer);
    jobWatchTimer = null;
  }
  lastBroadcastPhase = '';
  lastBroadcastState = '';
  tickSwarmJobWatcher();
  jobWatchTimer = setInterval(tickSwarmJobWatcher, 1000);
}

export function stopSwarmJobWatcher(): void {
  if (jobWatchTimer) {
    clearInterval(jobWatchTimer);
    jobWatchTimer = null;
  }
}

if (isSwarmJobRunning()) {
  startSwarmJobWatcher();
}

export function startSwarmAnalysis(opts: { full?: boolean } = {}): {
  ok: boolean;
  jobId?: string;
  startedAt?: string;
  error?: string;
  status?: number;
} {
  if (isSwarmJobRunning()) {
    const job = loadJobFile();
    return {
      ok: false,
      error: 'Analysis already running',
      status: 409,
      jobId: String(job?.jobId ?? ''),
    };
  }
  if (!existsSync(RUN_SCRIPT)) {
    return { ok: false, error: 'run-analysis.mjs not found', status: 500 };
  }

  const args = ['security-swarm/run-analysis.mjs', '--quiet'];
  if (opts.full) args.push('--full');

  const child = spawn(process.execPath, args, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  child.unref();

  lastBroadcastPhase = '';
  lastBroadcastState = '';
  startSwarmJobWatcher();
  setTimeout(() => tickSwarmJobWatcher(), 300);
  const startedAt = new Date().toISOString();
  return {
    ok: true,
    jobId: String(loadJobFile()?.jobId ?? ''),
    startedAt,
  };
}

export function readAnalysisReport(): { ok: boolean; text?: string; error?: string } {
  if (!existsSync(ANALYSIS_PATH)) {
    return { ok: false, error: 'analysis.txt not ready — run analysis first' };
  }
  return { ok: true, text: readFileSync(ANALYSIS_PATH, 'utf-8') };
}

export {
  REPO_ROOT,
  SWARM_DIR,
  readSwarmLatest,
  readSwarmSummaryMd,
  listSwarmFigures,
  readSwarmFigure,
  readPlainEnglishReport,
  readTrafficSummary,
  readUserServersSession,
} from './swarm-artifacts.js';
