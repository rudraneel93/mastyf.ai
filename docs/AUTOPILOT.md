# Guardian Autopilot

Plug-and-play autonomous MCP protection: realtime blocking, background threat learning, scheduled digests, and a simplified **Protection** dashboard workspace.

Policy YAML changes remain **human-reviewed** (`GUARDIAN_AI_AUTO_APPLY=false`).

## Quick start

From the **repo root** (Autopilot is in source; global `npm install -g` may not include it until the next package release):

```bash
pnpm build:guardian   # or: pnpm build
pnpm autopilot:init -- --apply
pnpm autopilot:start
```

Or use the local binary after build:

```bash
node dist/cli.js autopilot init --apply
node dist/cli.js autopilot start
```

Link the repo CLI globally (optional):

```bash
pnpm build:guardian && npm link
mcp-guardian autopilot init --apply
```

Open `http://localhost:4000/?workspace=home` (Protection workspace).

## Full plain-English analysis

One command or dashboard button for a complete security/health briefing (optional Ollama narrative):

```bash
pnpm analyze                    # markdown to stdout
pnpm analyze -- --output report.md
pnpm analyze -- --no-llm        # measured facts only
```

Dashboard: **Protection** workspace → **Full analysis (plain English)**.

Cost KPIs are hidden on the home overview; open **Operations → Cost** for FinOps detail.

Env: `GUARDIAN_FULL_ANALYSIS_LLM=true` (default on), `GUARDIAN_LLM_PROVIDER=ollama` for local prose.

### `unknown command 'autopilot'`

Your shell is running an **older** `mcp-guardian` from npm. Use one of:

- `pnpm autopilot:init -- --apply` (from this repo after `pnpm build:guardian`)
- `node dist/cli.js autopilot init --apply`
- `npm link` in the repo after rebuild, then retry `mcp-guardian autopilot …`

## What Autopilot enables

| Service | Env (set by profile) | Behavior |
|---------|----------------------|----------|
| Dashboard + WS | `DASHBOARD_ENABLED`, `GUARDIAN_WS_ENABLED` | Operator UI at :4000 |
| Runtime threat research | `GUARDIAN_THREAT_RESEARCH_AUTO` | Writes `adv-*.json` from blocks, semantic flags, intel |
| Discovery scheduler | `GUARDIAN_THREAT_DISCOVERY_AUTOSTART` | Hourly batch auto-research (+ reactive Threat Lab when semantic TPs exist) |
| AI learning | `GUARDIAN_AI_ENABLED` | SuggestionEngine cycles; suggestions queue for review |
| Semantic async | `GUARDIAN_SEMANTIC_ASYNC` | Flags feed threat research |
| Report scheduler | `GUARDIAN_REPORT_SCHEDULE=daily` | Digests under `reports/tenants/{tenant}/security-swarm/digests/` |

Config file: `~/.mcp-guardian/autopilot.json`

## CLI

```bash
mcp-guardian autopilot init [--apply]   # wrap MCP + block policy + write config
mcp-guardian autopilot start            # proxy + dashboard + background services
mcp-guardian autopilot status           # protection / learning / digest summary
```

## Dashboard APIs

- `GET /api/autopilot/status` — aggregated Autopilot health
- `GET /api/analysis/full` — full plain-English analysis (JSON)
- `GET /api/analysis/full/download` — same as markdown attachment
- `GET /api/reports/digests/latest` — last health markdown + security JSON digest
- `POST /api/reports/generate` — generate digest now
- `GET /api/ai/suggestions/pending` — policy suggestions awaiting review

## Prerequisites

- **Pro license** (`GUARDIAN_LICENSE_KEY` + control plane URL) for dashboard, swarm, semantic async
- **Local Ollama** + `ollama pull qwen3:8b` for Threat Lab / semantic features
- MCP clients routed through Guardian proxy (see `mcp-guardian onboard` / `autopilot init`)

## Manual override

Set `GUARDIAN_AUTOPILOT=true` or individual flags in `.env` instead of using the CLI profile.

Disable scheduled reports: `GUARDIAN_REPORT_SCHEDULE=off`.

See also [PRO_SETUP.md](./PRO_SETUP.md) and [THREAT_LAB.md](./THREAT_LAB.md).
