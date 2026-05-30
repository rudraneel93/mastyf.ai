# MCP Guardian — Architecture

Visual diagrams and integration prose are maintained in the README **[Architecture](https://github.com/rudraneel93/mcp-guardian#architecture)** section (Mermaid + embedded PNGs). This document is the technical companion: storage, transports, file map, and extension points.

---

## System overview

A typical local deployment runs **one Node process** (`pnpm dashboard:proxy`) that hosts:

| Layer | Responsibility |
|-------|----------------|
| **Proxy** | Intercepts MCP JSON-RPC on stdio, HTTP, SSE, WebSocket, streamable HTTP |
| **Policy** | YAML rules, hot-reload, shared rate-limit store |
| **Agentic** (optional) | Pre/post hooks, autonomous modules, dashboard summaries |
| **Dashboard** | REST + WebSocket over the same SQLite audit DB |
| **Upstream** | Child MCP servers or HTTP relays (filesystem, GitHub, etc.) |

See README diagrams: [System overview](https://github.com/rudraneel93/mcp-guardian#system-overview), [Tool call path](https://github.com/rudraneel93/mcp-guardian#tool-call-path-tools_call), [Agentic AI](https://github.com/rudraneel93/mcp-guardian#agentic-ai-integration), [Dashboard](https://github.com/rudraneel93/mcp-guardian#dashboard-and-observability), [Learning loop](https://github.com/rudraneel93/mcp-guardian#continuous-improvement-loop).

---

## Tool call pipeline

Every `tools/call` follows the same governance stack (blocked calls never reach upstream):

1. **Transport** receives JSON-RPC (`src/proxy/*-proxy-server.ts` or `proxy-server.ts` for stdio).
2. **Pre-forward guard** — `src/proxy/tool-call-pre-guard.ts`: expanded payload size cap + agentic hooks via `src/proxy/agentic-hooks-bridge.ts`.
3. **Policy** — `PolicyEngine.evaluateAsync` (`src/policy/policy-engine.ts`); rate limits use `src/policy/rate-limit-store.ts` across hot-reload.
4. **Semantic gate** — `src/proxy/proxy-post-policy-gates.ts` (optional LLM/heuristic on arguments).
5. **Forward** to upstream MCP server.
6. **Response gate** — DLP / streaming inspector where configured (`src/agentic/response-dlp/`).
7. **Audit** — `persistCallRecord` → `src/database/audit-write-queue.ts` → SQLite; denials → `StructuredLogger.logBlocked` for SIEM.

---

## Local audit storage (SQLite)

MCP Guardian persists proxy audit, security scans, and cost history in **SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)** — not `sql.js`.

| Property | Value |
|----------|--------|
| Driver | `better-sqlite3` (native, synchronous) |
| Journal | **WAL** (`PRAGMA journal_mode = WAL`) |
| Contention | **`busy_timeout = 5000`** ms for proxy + TUI concurrent access |
| Path | `MCP_GUARDIAN_DB_PATH` (see `src/utils/guardian-db-path.ts`) |
| Optional encryption | `GUARDIAN_DB_ENCRYPT_AUDIT_ARGS` for sensitive argument fields |

The v2.3+ `HistoryDatabase` (`src/database/history-db.ts`) replaced an older in-memory `sql.js` experiment. Production and npm builds ship `better-sqlite3` only; there is no `sql.js` runtime dependency.

For fleet-scale or HA deployments, use **`DB_TYPE=postgres`** + `DATABASE_URL` (optionally through PgBouncer) — see [SCALE_AND_RESILIENCE.md](SCALE_AND_RESILIENCE.md).

Agentic state uses migration `src/database/migrations/011-agentic-tables.sql` (14 tables).

---

## Transport coverage

| Transport | Entry module | `tools/call` governance |
|-----------|--------------|-------------------------|
| **stdio** | `src/proxy/proxy-server.ts` | Full pipeline |
| **HTTP** | `src/proxy/http-proxy-server.ts` | Full + pre-forward guard |
| **SSE** | `src/proxy/sse-proxy-server.ts` | Full + pre-forward guard |
| **WebSocket** | `src/proxy/websocket-proxy-server.ts` | Full + pre-forward guard |
| **Streamable HTTP** | `src/proxy/streamable-http-proxy-server.ts` | Full + pre-forward guard |

Run `mcp-guardian onboard` so IDE configs point at Guardian-wrapped servers. If an IDE connects **directly** to an upstream SSE URL, calls are **untracked** — metric `mcp_guardian_sse_untracked_servers` and log event `sse_untracked` indicate missing wrap.

---

## File map

| Area | Path | Notes |
|------|------|--------|
| **CLI / entry** | `src/cli.ts`, `src/index.ts` | Commands, MCP tool registration (incl. agentic tools) |
| **DI boot** | `src/container.ts` | Wires policy, proxy, dashboard, agentic services |
| **Proxy (stdio)** | `src/proxy/proxy-server.ts` | `McpProxyServer` — default wrapped transport |
| **Proxy (network)** | `src/proxy/http-proxy-server.ts`, `sse-proxy-server.ts`, `websocket-proxy-server.ts`, `streamable-http-proxy-server.ts` | Same governance + pre-guard |
| **Pre-guard** | `src/proxy/tool-call-pre-guard.ts`, `agentic-hooks-bridge.ts` | Payload limits + agentic hooks |
| **Post-policy gates** | `src/proxy/proxy-post-policy-gates.ts` | Semantic request/response gates |
| **Policy** | `src/policy/policy-engine.ts`, `policy-watcher.ts`, `rate-limit-store.ts` | YAML evaluation, hot-reload |
| **Audit** | `src/database/history-db.ts`, `audit-write-queue.ts`, `src/utils/call-record-cost.ts` | `call_records`, async writes |
| **Dashboard API** | `src/utils/dashboard-server.ts`, `src/dashboard/agentic-routes.ts` | REST + static SPA |
| **Agentic summary** | `src/utils/agentic-dashboard-summary.ts` | `/api/agentic/*` aggregates |
| **Agentic runtime** | `src/agentic/core.ts`, `proxy-integration.ts`, `scheduler.ts` | Hooks, pipelines, cron tasks |
| **Auth / enterprise** | `src/auth/`, `src/utils/redis-circuit-sync.ts` | JWT, DPoP, Redis-backed limits |
| **SIEM / metrics** | `src/utils/structured-logger.ts`, exporters under `src/` | `MCP_GUARDIAN_SIEM_ENABLED`, Prometheus |
| **Dashboard SPA** | `deploy/dashboard-spa/` | Next.js workspaces (Protection, Activity, Agentic AI) |
| **Security Swarm** | `security-swarm/` | Offline red-team; reports in `reports/security-swarm/` |
| **Harness** | `adversarial-harness/` | Corpus + custom attacks (`adv-*.json`) |
| **Default policy** | `default-policy.yaml` | Shipped baseline rules |

Related docs: [AGENTIC_ARCHITECTURE.md](AGENTIC_ARCHITECTURE.md), [THREAT_LAB.md](THREAT_LAB.md), [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md).

---

## Pro pipelines (offline)

These run **beside** the live proxy; they improve detection and corpus coverage over time.

| Pipeline | Asset | Run |
|----------|-------|-----|
| **Security Swarm** | [security-swarm-architecture.png](assets/security-swarm-architecture.png) | `pnpm security-swarm` |
| **Threat Lab** | [llm-threat-discovery-architecture.png](assets/llm-threat-discovery-architecture.png) | `pnpm security-swarm:threat-lab` |
| **Auto Threat Research** | [auto-threat-research-architecture.png](assets/auto-threat-research-architecture.png) | `GUARDIAN_THREAT_RESEARCH_AUTO` + proxy |

README embeds these diagrams with integration prose under [Pro pipeline architecture](https://github.com/rudraneel93/mcp-guardian#pro-pipeline-architecture).

---

## Extension points

| Extension | How |
|-----------|-----|
| **Custom policy** | Edit `policy.yaml` (or path from `MCP_GUARDIAN_POLICY_PATH`); hot-reload via `policy-watcher.ts` |
| **Allowlists / RBAC** | Policy YAML + `src/policy/` matchers; see [POLICY.md](POLICY.md) |
| **Plugin SDK** | `plugin-sdk/` — custom exporters, hooks (see package README) |
| **SIEM exporters** | Enable `MCP_GUARDIAN_SIEM_ENABLED`; configure structured log sinks |
| **Semantic gate** | Env + policy flags for LLM/heuristic gates (`proxy-post-policy-gates.ts`) |
| **Agentic modules** | Register in `container.ts`; hook via `proxy-integration.ts` |
| **Attack corpus** | Add `adversarial-harness/fixtures/custom-attacks/adv-*.json`; run harness or swarm |
| **Threat Lab output** | Review `threat-lab-candidates.json` before applying to policy |

---

## Token accounting

`TokenCounter` (`src/utils/token-counter.ts`) is provider-aware (OpenAI tiktoken, Anthropic optional tokenizer, char-ratio fallbacks). Counts are **exact only when upstream returns API `usage`**; otherwise `tokenSource: estimated`.

---

## Observability

| Signal | Source |
|--------|--------|
| **Dashboard charts** | `history.db` → dashboard REST |
| **Live updates** | WebSocket when `GUARDIAN_WS_ENABLED=true` |
| **Prometheus** | Proxy metrics endpoint (when enabled) |
| **SIEM** | `StructuredLogger` block/allow events |

Ensure `MCP_GUARDIAN_DB_PATH` matches between proxy and dashboard so Activity views reflect live traffic.
