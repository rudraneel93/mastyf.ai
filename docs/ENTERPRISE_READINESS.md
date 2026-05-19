# Enterprise Readiness Scorecard

Honest assessment of MCP Guardian for production vs pilot deployments (2026-05-19).

## Production-ready

| Area | Status | Notes |
|------|--------|-------|
| Regex + schema policy engine | Ready | 154/154 corpus attacks with `GUARDIAN_DISABLE_SEMANTIC=true` |
| Request-path PI (`scanToolCallArguments`) | Ready | All argument string leaves |
| Stdio proxy + audit queue | Ready | Async `audit-write-queue`; hot path non-blocking |
| Multi-tenant JWT binding | Ready | `GUARDIAN_MULTI_TENANT_ENABLED` rejects header spoofing when authenticated |
| Dashboard auth (API key / JWT / CSRF) | Ready | RBAC roles: viewer → admin + tenant-admin |
| Streaming response inspection | Ready | 64KB chunked windows; `GUARDIAN_SKIP_RESPONSE_SCAN` for trusted upstream |
| Local semantic fallback | Ready | Heuristic scorer when no LLM API key |
| OPA + distributed eval cache | Ready | `policy.opa: true` + `REDIS_URL`; `GUARDIAN_POLICY_EVAL_CACHE` |
| Integration fixture matrix | Ready | `pnpm test:integration` — echo + filesystem stdio fixtures |
| Per-tenant Prometheus labels | Ready | `tenant_id` on request/block/latency metrics |
| Per-tenant daily budget | Ready | `GUARDIAN_TENANT_DAILY_BUDGET_JSON` |

## Pilot / requires configuration

| Area | Status | Notes |
|------|--------|-------|
| LLM semantic async audit | Pilot | Needs `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`; local fallback flags only |
| OPA/Rego | Pilot | Set `opa: true` in policy YAML and `OPA_URL` |
| Redis-backed policy cache | Pilot | Requires `REDIS_URL` |
| Dashboard RBAC | Pilot | Map keys via `GUARDIAN_DASHBOARD_ROLES`; login role via `GUARDIAN_DASHBOARD_LOGIN_ROLE` |
| SSE/WebSocket proxies | Pilot | MVP parity; validate in your transport mix |
| SPIFFE/mTLS | Pilot | See [SPIFFE.md](./SPIFFE.md) |

## Not yet / gaps

| Area | Status | Notes |
|------|--------|-------|
| Hosted SaaS control plane | Not included | Self-hosted binary/Helm only |
| Formal SOC2 / FedRAMP artifacts | Not included | Use your compliance program |
| Guaranteed &lt;50ms p95 at all concurrencies | Aspirational | c=1 target &lt;150ms validated; tune env + hardware |
| Full dashboard policy editor | Partial | Policy test API; YAML still source of truth |

## Recommended production checklist

1. `policy.mode: block` + `default_action: block` with allowlists
2. `GUARDIAN_MULTI_TENANT_ENABLED=true` + JWT tenant claim
3. `DASHBOARD_API_KEY` or `DASHBOARD_JWT_SECRET` + `GUARDIAN_DASHBOARD_ROLES`
4. `REDIS_URL` for rate limits, idempotency, policy eval cache (multi-replica)
5. `pnpm eval` + `pnpm verify:corpus` in CI
6. `pnpm test:integration` in CI
7. `LOG_LEVEL=error BENCH_PROXY_CONCURRENCY_TIERS=1 pnpm benchmark:proxy-tiers` on release candidates

## Key environment variables

| Variable | Purpose |
|----------|---------|
| `GUARDIAN_DASHBOARD_ROLES` | API key → role map |
| `GUARDIAN_SKIP_RESPONSE_SCAN` | Skip chunked response PI (trusted servers) |
| `GUARDIAN_LOCAL_SEMANTIC` | Local heuristic when LLM absent (default on) |
| `GUARDIAN_POLICY_EVAL_CACHE` | Redis/LRU policy decision cache |
| `GUARDIAN_TENANT_DAILY_BUDGET_JSON` | Per-tenant USD caps |
| `GUARDIAN_OPA_ENABLED` | Enable OPA when `opa: true` in YAML |
