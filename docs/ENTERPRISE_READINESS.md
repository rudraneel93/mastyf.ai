# Enterprise Readiness Scorecard

Honest assessment of MCP Guardian for production vs pilot deployments (2026-05-19, updated post v2.9.7 remediation).

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
| Per-tenant daily budget | Ready | `GUARDIAN_TENANT_DAILY_BUDGET_JSON`; enforced on proxy semantic path (v2.10.0) |
| Dashboard policy editor | Ready | `PUT /api/policy`, editable PolicyPanel, RBAC `policy_mutate` |
| Shared HTTP/SSE gateway | Ready | `GUARDIAN_GATEWAY_MODE` + Helm `gateway.*` (v2.10.0) |
| WebSocket transport | Ready | `transport: websocket` in ProxyManager (v2.10.0) |
| Response DLP redact mode | Ready | `GUARDIAN_RESPONSE_DLP_MODE=redact` (scrub-and-pass) |
| Response DLP decode + labeled redaction | Ready | HTML/URL decode before scan; `X-Guardian-Redaction-Reason` / `_meta.redaction` |
| Core semantic circuit breaker + local fallback | Ready | `packages/core` — breaker, heuristics, per-tenant queue caps (v2.10.0+) |
| Policy compile cache (hot-reload) | Ready | `getOrCreatePolicyEngine()` — `policy-engine-cache.ts` |
| Dashboard cost query cache | Ready | `GUARDIAN_DASHBOARD_QUERY_CACHE` + Redis TTL |
| Postgres backup CronJob (Helm) | Ready | `postgres-backup-cronjob.yaml` when `database.type=postgres` |
| PgBouncer transaction pool config | Ready | Helm ConfigMap + `docs/DATABASE_OPERATIONS.md` |
| call_records partitioning guide | Ready | Migration `007` index + operator partition DDL doc |
| Semantic LLM circuit breaker + rate limit | Ready | `GUARDIAN_SEMANTIC_CIRCUIT_*`, `GUARDIAN_SEMANTIC_LLM_MAX_PER_MIN` |
| Per-tenant audit JSONL + dashboard access log | Ready | `~/.mcp-guardian/tenants/{id}/`; `GET /api/audit`, `GET /api/admin/access-log` |
| Regex eval wall-clock budget | Ready | `GUARDIAN_REGEX_EVAL_TIMEOUT_MS` (default 50ms) |
| Unified upstream timeout | Ready | `GUARDIAN_UPSTREAM_TIMEOUT_MS` on HTTP/SSE/WS/streamable |
| Attack block + cost Prometheus metrics | Ready | `mcp_guardian_attacks_blocked_total`, `mcp_guardian_cost_spent_usd` |
| HIPAA / PCI policy templates | Ready | `policy-templates/hipaa-compliance.yaml`, `pci-dss-masking.yaml` |
| Postgres RLS (tenant isolation) | Ready | `006` + `008-tenant-rls-extended.sql`, `postgres-tenant-session.ts`; on in enterprise Helm |
| SIEM exporter DLQ + retry | Ready | `~/.mcp-guardian/exporter-dlq/`; `GUARDIAN_EXPORTER_MAX_RETRIES` |
| Field encryption per-deployment salt | Ready | `genc2:` format; `GUARDIAN_DB_ENCRYPTION_SALT` optional |
| JWT max lifetime + revocation denylist | Ready | Memory + Redis (`GUARDIAN_TOKEN_REVOCATION_REDIS`); OIDC introspection optional |
| Sync semantic response gate | Ready | stdio / SSE / WebSocket / HTTP (`gateToolResponseText`) |
| DPoP URI normalization | Ready | `normalizeDpopUri()` in `src/auth/dpop.ts` |
| mTLS cert hot-reload | Ready | `MtlsCertWatcher` + `getMtlsAgent()` wired in HTTP/SSE proxies |
| OPA result schema validation | Ready | `parseOpaResult()` — `{ allow: boolean, reason?: string }` |
| Cluster rug-pull alerts | Ready | `REDIS_URL` + `rug-pull-cluster.ts` |
| Per-tool timeouts | Ready | `GUARDIAN_TOOL_TIMEOUT_JSON` |
| Compliance report generator | Ready | `pnpm enterprise:compliance-report` |

## Pilot / requires configuration

| Area | Status | Notes |
|------|--------|-------|
| LLM semantic async audit | Pilot | Needs `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`; local fallback flags only |
| OPA/Rego | Pilot | Set `opa: true` in policy YAML and `OPA_URL` |
| Redis-backed policy cache | Pilot | Requires `REDIS_URL` |
| Dashboard RBAC | Pilot | Map keys via `GUARDIAN_DASHBOARD_ROLES`; login role via `GUARDIAN_DASHBOARD_LOGIN_ROLE` |
| SSE/WebSocket proxies | Ready | Gateway mode + transport parity tests; tune per deployment |
| SPIFFE/mTLS | Pilot | See [SPIFFE.md](./SPIFFE.md) |

## Enterprise deploy artifacts (v2.9.3+)

| Artifact | Purpose |
|----------|---------|
| [ENTERPRISE_DEPLOY.md](./ENTERPRISE_DEPLOY.md) | P0/P1/P2 deployment checklist |
| [deploy/helm/mcp-guardian/values-enterprise.yaml](../deploy/helm/mcp-guardian/values-enterprise.yaml) | HA Helm overlay |
| [scripts/verify-enterprise-preflight.sh](../scripts/verify-enterprise-preflight.sh) | `pnpm enterprise:preflight` |
| [ENTERPRISE_EVIDENCE_PACK.md](./ENTERPRISE_EVIDENCE_PACK.md) | `pnpm enterprise:evidence-pack` |
| [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) | v3 / platform priorities |

## Not yet / gaps

| Area | Status | Notes |
|------|--------|-------|
| Hosted SaaS control plane | Not included | Self-hosted binary/Helm only — see [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) |
| Formal SOC2 / FedRAMP artifacts | Not included | Use your compliance program |
| Guaranteed &lt;50ms p95 at all concurrencies | Aspirational | c=1 target &lt;150ms validated; tune env + hardware |
| `@mcp-guardian/core` JSON Schema validation | Ready | Ajv pre-check in schema-scanner (v2.10.0) |
| Security swarm step timeouts + signed evasion | Ready | `run-step.mjs`, HMAC manifest (v2.10.0) |
| 50-replica Postgres scale evidence | Pilot | `pnpm test:scale-postgres`; not full multi-region failover |

**Target scorecard:** 9.0+ for security/audit after v2.10.0 (`reports/enterprise-mcp-tests-31/gap-matrix.md`).

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
| `GUARDIAN_SEMANTIC_SYNC_RESPONSE` | Sync heuristic/LLM gate on tool responses |
| `GUARDIAN_OIDC_INTROSPECTION` | RFC 7662 active check after JWT verify |
| `GUARDIAN_TOKEN_REVOCATION_REDIS` | Persist revocation denylist in Redis (default on when `REDIS_URL` set) |
| `GUARDIAN_DASHBOARD_QUERY_CACHE` | Redis/local TTL for expensive dashboard reads |
| `GUARDIAN_DASHBOARD_QUERY_CACHE_TTL_MS` | Dashboard query cache TTL (default 15s) |
