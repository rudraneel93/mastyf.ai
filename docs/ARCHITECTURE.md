# MCP Guardian — Architecture Notes

## Local audit storage (SQLite)

MCP Guardian persists proxy audit, security scans, and cost history in **SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)** — not `sql.js`.

| Property | Value |
|----------|--------|
| Driver | `better-sqlite3` (native, synchronous) |
| Journal | **WAL** (`PRAGMA journal_mode = WAL`) |
| Contention | **`busy_timeout = 5000`** ms for proxy + TUI concurrent access |
| Path | `MCP_GUARDIAN_DB_PATH` (see `src/utils/guardian-db-path.ts`) |

The v2.3+ `HistoryDatabase` (`src/database/history-db.ts`) replaced an older in-memory `sql.js` experiment. Production and npm builds ship `better-sqlite3` only; there is no `sql.js` runtime dependency.

For fleet-scale or HA deployments, use **`DB_TYPE=postgres`** + `DATABASE_URL` (optionally through PgBouncer) — see [SCALE_AND_RESILIENCE.md](SCALE_AND_RESILIENCE.md).

## Transport coverage

| Transport | Governance path |
|-----------|------------------|
| **stdio** | Full JSON-RPC interception via `McpProxyServer` |
| **SSE/HTTP** | `SseProxyServer` for `tools/call` when routed through Guardian; scan reports `untrackedSse` when the IDE connects upstream directly |

Structured log event `sse_untracked` and metric `mcp_guardian_sse_untracked_servers` surface SSE servers that need explicit proxy/wrap routing.

## Token accounting

`TokenCounter` (`src/utils/token-counter.ts`) is provider-aware (OpenAI tiktoken, Anthropic optional tokenizer, char-ratio fallbacks). Counts are **exact only when upstream returns API `usage`**; otherwise `tokenSource: estimated`.
