/**
 * Read security-swarm report artifacts for dashboard API.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dir, '..', '..');

export const SWARM_DIR = join(REPO_ROOT, 'reports', 'security-swarm');
export const FIGURES_DIR = join(SWARM_DIR, 'figures');
export const LIVE_SESSION_PATH = join(
  REPO_ROOT,
  'scenarios',
  'real-life',
  'output',
  'live-filesystem-session.json',
);

export function readLiveFilesystemSession(): Record<string, unknown> | null {
  if (!existsSync(LIVE_SESSION_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LIVE_SESSION_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readSwarmLatest(): Record<string, unknown> | null {
  const p = join(SWARM_DIR, 'latest.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readSwarmSummaryMd(): string | null {
  const p = join(SWARM_DIR, 'summary.md');
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

export function listSwarmFigures(): string[] {
  if (!existsSync(FIGURES_DIR)) return [];
  return readdirSync(FIGURES_DIR)
    .filter((f) => f.endsWith('.png'))
    .sort();
}

export interface SwarmFigureEntry {
  name: string;
  title: string;
  category: string;
  url: string;
  generatedAt?: string;
  dataSource?: string;
}

export function readFiguresManifest(): { generatedAt?: string; figures: SwarmFigureEntry[] } {
  if (!existsSync(FIGURES_MANIFEST_PATH)) {
    return {
      figures: listSwarmFigures().map((name) => ({
        name,
        title: name.replace('.png', '').replace(/-/g, ' '),
        category: 'other',
        url: `/reports/security-swarm/figures/${name}`,
      })),
    };
  }
  try {
    const raw = JSON.parse(readFileSync(FIGURES_MANIFEST_PATH, 'utf-8')) as {
      generatedAt?: string;
      figures?: SwarmFigureEntry[];
    };
    return { generatedAt: raw.generatedAt, figures: raw.figures ?? [] };
  } catch {
    return { figures: [] };
  }
}

export function readVisualsData(): Record<string, unknown> | null {
  if (!existsSync(VISUALS_DATA_PATH)) return null;
  try {
    return JSON.parse(readFileSync(VISUALS_DATA_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readSwarmFigure(name: string): Buffer | null {
  if (!name || name.includes('..') || !name.endsWith('.png')) return null;
  const p = join(FIGURES_DIR, name);
  if (!existsSync(p)) return null;
  return readFileSync(p);
}

export const USER_SERVERS_PATH = join(SWARM_DIR, 'user-servers-session.json');
export const TRAFFIC_SUMMARY_PATH = join(SWARM_DIR, 'traffic-summary.json');
export const REPORT_JSON_PATH = join(SWARM_DIR, 'report.json');
export const VISUALS_DATA_PATH = join(SWARM_DIR, 'visuals-data.json');
export const FIGURES_MANIFEST_PATH = join(FIGURES_DIR, 'manifest.json');

export function readUserServersSession(): Record<string, unknown> | null {
  if (!existsSync(USER_SERVERS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(USER_SERVERS_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readTrafficSummary(): Record<string, unknown> | null {
  if (!existsSync(TRAFFIC_SUMMARY_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TRAFFIC_SUMMARY_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readPlainEnglishReport(): Record<string, unknown> | null {
  if (!existsSync(REPORT_JSON_PATH)) return null;
  try {
    return JSON.parse(readFileSync(REPORT_JSON_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Build report.json from latest.json / analysis artifacts when missing (e.g. pre-MVP runs). */
export function ensurePlainEnglishReport(): Record<string, unknown> | null {
  const existing = readPlainEnglishReport();
  if (existing) return existing;

  const hasSource =
    existsSync(join(SWARM_DIR, 'latest.json'))
    || existsSync(join(SWARM_DIR, 'analysis.txt'));
  if (!hasSource) return null;

  const script = join(REPO_ROOT, 'security-swarm', 'agents', 'plain-english-report.mjs');
  if (!existsSync(script)) return null;

  spawnSync(process.execPath, [script], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    env: process.env,
  });
  return readPlainEnglishReport();
}

export function readSwarmTextArtifact(name: string): string | null {
  const allowed = new Set(['summary.md', 'swarm-report.txt', 'analysis.txt', 'job.log']);
  if (!allowed.has(name)) return null;
  const p = join(SWARM_DIR, name);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}
