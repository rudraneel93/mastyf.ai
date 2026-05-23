#!/usr/bin/env npx tsx
/**
 * ToolWatch agent — baseline tools/list per MCP server; diff + classify rug-pull signals.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  buildServerBaseline,
  diffToolBaselines,
  summarizeToolIntegrityReports,
  type ServerToolBaseline,
  type ToolIntegrityReport,
} from '../../src/ai/tool-integrity-watch.js';
import { exitUnlessProFeature } from '../../src/license/enforce-pro.js';

await exitUnlessProFeature('swarm');

const OUT_DIR = join(process.cwd(), 'reports', 'security-swarm');
const BASELINE_PATH = join(OUT_DIR, 'tool-integrity-baseline.json');
const SESSION_PATH = join(OUT_DIR, 'user-servers-session.json');
const REPORT_PATH = join(OUT_DIR, 'tool-watch.json');

type SessionEntry = {
  serverName: string;
  status: string;
  toolNames?: string[];
  tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
};

function loadBaseline(): Record<string, ServerToolBaseline> {
  if (!existsSync(BASELINE_PATH)) return {};
  try {
    const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as {
      baselines?: Record<string, ServerToolBaseline>;
    };
    return raw.baselines || {};
  } catch {
    return {};
  }
}

async function ensureSession(): Promise<SessionEntry[]> {
  if (existsSync(SESSION_PATH)) {
    const raw = JSON.parse(readFileSync(SESSION_PATH, 'utf-8')) as { servers?: SessionEntry[] };
    if (raw.servers?.length) return raw.servers;
  }
  const { runUserServerProbes } = await import('../security-swarm/probe-user-servers.mjs');
  const result = await runUserServerProbes();
  return (result.servers || []) as SessionEntry[];
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const baselines = loadBaseline();
  const servers = await ensureSession();
  const reports: ToolIntegrityReport[] = [];
  const updatedBaselines = { ...baselines };

  for (const srv of servers) {
    if (srv.status !== 'ok') continue;
    const toolDefs =
      srv.tools ||
      (srv.toolNames || []).map((name) => ({ name, description: '', inputSchema: {} }));
    const current = buildServerBaseline(srv.serverName, toolDefs);
    const previous = baselines[srv.serverName] || null;
    const report = diffToolBaselines(previous, current);
    reports.push(report);

    if (!previous || process.env.SWARM_TOOL_WATCH_UPDATE_BASELINE === 'true') {
      updatedBaselines[srv.serverName] = current;
    }
  }

  const summary = summarizeToolIntegrityReports(reports);
  const out = {
    agent: 'tool-watch',
    timestamp: new Date().toISOString(),
    summary,
    reports,
  };

  writeFileSync(REPORT_PATH, JSON.stringify(out, null, 2));
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ baselines: updatedBaselines, updatedAt: new Date().toISOString() }, null, 2),
  );

  console.log(
    `[tool-watch] ${summary.serversChecked} server(s), ${summary.serversChanged} changed, ${summary.criticalCount} critical`,
  );
  if (summary.quarantineServers.length) {
    console.log(`[tool-watch] quarantine recommended: ${summary.quarantineServers.join(', ')}`);
  }

  process.exit(summary.criticalCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
