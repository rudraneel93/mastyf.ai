# Real-life scenario

Exercises MCP Guardian against mixed configs (scan/report) and **live proxy** sessions including the official `@modelcontextprotocol/server-filesystem` upstream MCP.

## Required environment

| Variable | Purpose |
|----------|---------|
| `MCP_FS_ROOT` | Writable sandbox for official filesystem MCP (default: temp dir) |
| `NVD_API_KEY` | Optional — higher NVD rate limits for CVE scans |
| `GUARDIAN_MODEL` / server `env` | Model id for cost pricing when proxy records calls |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / Ollama | Optional — async semantic audit in hybrid live session |
| `DATABASE_URL` | Optional — PostgreSQL semantic audit persistence |

## Quick start — one-click analysis

```bash
pnpm build
pnpm security-swarm:analyze
# alias:
pnpm real-life:swarm
```

This runs the unified orchestrator (`security-swarm/run-analysis.mjs`):

1. **Track B** — Live official filesystem MCP (hybrid profile) → `scenarios/real-life/output/live-filesystem-session.json`
2. Semantic calibration (`pnpm security-swarm:calibrate`)
3. **Track A** — Security swarm fast gates (or `:live` with `pnpm security-swarm:analyze:full`)
4. Figures under `reports/security-swarm/figures/` (when matplotlib is available)
5. **`reports/security-swarm/analysis.txt`** — detailed plain-text report (primary deliverable)

Orchestrator flags: `--skip-live`, `--skip-swarm`, `--full`, `--quiet`

Legacy chain (same steps, no `analysis.txt` synthesis): `node scenarios/real-life/run-real-mcp-swarm.mjs`

## Individual steps

```bash
pnpm build

# Scan / report (mixed servers in mcp-config.json)
node dist/cli.js scan -c scenarios/real-life/mcp-config.json
node dist/cli.js report -c scenarios/real-life/mcp-config.json --output scenarios/real-life/output/report.json

# Echo proxy smoke (legacy)
node scenarios/real-life/run-live-proxy-test.mjs

# Official filesystem MCP + learning burst
node scenarios/real-life/run-official-filesystem-scenario.mjs
# → scenarios/real-life/output/live-filesystem-session.json

node dist/cli.js audit -c scenarios/real-life/proxy-test-config.json
```

## Hybrid profile (live filesystem)

During `run-official-filesystem-scenario.mjs`:

- `GUARDIAN_AI_INSTANT_LEARNING=true`
- `GUARDIAN_SEMANTIC_ASYNC=true`
- `GUARDIAN_DISABLE_SEMANTIC=false`

Repeat-block burst (`REAL_LIFE_BURST_REPEATS`, default 6) drives instant attack-pattern learning after blocked scenarios.

## CI strict mode

`GUARDIAN_SCAN_STRICT=true` fails scan/report when:

- CVE lookup is `degraded` or `unavailable`
- Any server lacks authentication
- Typo-squat risk is detected

Use in CI after `NVD_API_KEY` is configured for reliable CVE feeds.

## Artifacts

| Path | Content |
|------|---------|
| `output/live-filesystem-session.json` | Live proxy scenario results + learning snapshot |
| `output/05-proxy-live.json` | Echo proxy smoke results |
| `reports/security-swarm/summary.md` | Track A + Track B merged after `real-life:swarm` |
| `reports/security-swarm/figures/fig7-live-filesystem-results.png` | Per-scenario pass/block chart |

## Cost audit (`05-proxy-live`)

After `run-live-proxy-test.mjs`, `mcp-guardian audit` should show **actual** costs from `call_records`. If empty, the note distinguishes “no DB rows” vs “wrong server name”.
