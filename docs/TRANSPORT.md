# MCP transport proxy behavior

## Stdio (`McpProxyServer`)

Full JSON-RPC line proxy with policy, OAuth, circuit breaker, token/cost `call_records`, rug-pull detection, and `GUARDIAN_PROXY_MAX_INFLIGHT` (default **50**) fail-fast when too many concurrent `tools/call` are awaiting upstream responses.

- **Stdin serialization** — CLI and proxy use `AsyncSerialQueue` so rapid stdin lines do not race `currentRequestId`.
- **Optional pool** — `GUARDIAN_STDIO_POOL_SIZE` (2–4) spawns round-robin stdio workers via `StdioConnectionPool` in `ProxyManager`.

## HTTP+SSE (`SseProxyServer`)

Faithful MCP HTTP+SSE surface when started via `ProxyManager`:

| Method | Path | Role |
|--------|------|------|
| `GET` | `/sse` or `/` | Long-lived SSE; relays upstream stream; emits `event: endpoint` with local `/message?sessionId=…` |
| `POST` | `/message?sessionId=…` | JSON-RPC; policy on `tools/call`; persists `call_records` |

Point IDE/agents at `http://127.0.0.1:<listenPort>/sse` (port logged on proxy start). Programmatic API: `interceptAndForward()` for tests and integrations.

Env: `GUARDIAN_SSE_PROXY_PORT` (optional fixed port per server via `env.GUARDIAN_SSE_PROXY_PORT` in MCP config).

mTLS and cert pinning: `MCP_TLS_*`, `GUARDIAN_UPSTREAM_CERT_PIN_SHA256`, optional `GUARDIAN_SPIFFE_SOCKET_PATH` ([SPIFFE.md](./SPIFFE.md)).

## HTTP pass-through (`HttpProxyServer`)

Transparent forward of method, headers, and body to upstream URL (GET/SSE-safe). Policy on `tools/call` POST bodies. DPoP enforced in block mode when authenticated.

For `tools/call` JSON responses: `gateToolResponseText` (DLP / sync semantic / inspection), session rotation via `x-mcp-guardian-session-token` header and `result._meta.sessionToken`, mTLS via `getMtlsAgent()`.

## WebSocket (`WebSocketProxyServer`)

Policy, OAuth/DPoP, circuit breaker, secret scan on args, rug-pull `tools/list` fingerprint, `gateToolResponseText` on tool results, session cache + rotation (`result._meta.sessionToken`), `persistCallRecord`, structured logging.

**v2.10.0:** Started from `ProxyManager` when `transport: "websocket"` in MCP config, or in **`GUARDIAN_GATEWAY_MODE`** / `mcp-guardian proxy --gateway`. Set `GUARDIAN_WS_PROXY_PORT` per server in `mcp.json` env.

## Streamable HTTP (`StreamableHttpProxyServer`)

MCP streamable HTTP handler:

| Method | Path | Role |
|--------|------|------|
| `POST` | `/mcp` | JSON-RPC object or batch; policy on `tools/call` |

Set `GUARDIAN_STREAMABLE_HTTP_UPSTREAM_RELAY=true` to forward each message to `{upstreamBaseUrl}/mcp` with `gateToolResponseText` on tool results, session cache, and mTLS via `getMtlsAgent()`. Without relay, returns a stub `forwarded: true` payload for policy testing.

## Benchmarks

| Script | Purpose |
|--------|---------|
| `pnpm benchmark:proxy-tiers` | Stdio proxy SLOs at 1 / 10 / 25 / 50 in-flight |
| `pnpm benchmark:proxy-slo` | Pipelined CI gate (p95 &lt; 150 ms) |
| `pnpm benchmark:concurrent-proxy` | 1000-way burst contention |

See `benchmarks/results/proxy-slo-by-concurrency-summary.md` for latest tier numbers.
