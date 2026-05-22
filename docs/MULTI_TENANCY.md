# Multi-Tenancy

MCP Guardian supports **logical multi-tenancy** on a shared deployment: one proxy/dashboard process can serve multiple tenants with isolated circuit breakers, rate limits, sessions, attack-learning state, and audit rows — without requiring separate databases per tenant.

For full data-plane silos (dedicated Postgres/Redis clusters per tenant), run separate Guardian instances or namespaces; this document describes in-process and shared-store isolation.

## Quick start

### Single tenant (default)

No configuration required. All resources use tenant id `default`.

```bash
export GUARDIAN_TENANT_ID=default   # optional explicit label
```

### Shared gateway (multi-tenant mode)

Enable header-based tenant routing on HTTP/SSE/dashboard:

```bash
export GUARDIAN_MULTI_TENANT_ENABLED=true
# Pod fallback when clients omit headers:
export GUARDIAN_TENANT_ID=default
```

Clients send one of:

| Header | Example |
|--------|---------|
| `X-Guardian-Tenant` | `acme-corp` |
| `X-Tenant-Id` | `acme-corp` |

Stdio MCP proxy accepts `params._meta.tenantId` on `tools/call`.

### JWT-bound tenant (authenticated)

When `GUARDIAN_MULTI_TENANT_ENABLED=true` **and** the request is authenticated:

1. Tenant id **must** appear on the verified JWT (`GUARDIAN_JWT_TENANT_CLAIM`, default `tenant_id`).
2. `X-Guardian-Tenant`, `X-Tenant-Id`, or `_meta.tenantId` must **match** the JWT claim (or be omitted).
3. Mismatch returns **403** / JSON-RPC **-32003**.

Unauthenticated requests may still use headers/env as before.

## Tenant id rules

- Alphanumeric + hyphen only
- Max 64 characters
- Must start and end with alphanumeric
- Rejects empty, `/`, `\`, `..` (path traversal)

Invalid ids return HTTP **400** (dashboard/HTTP proxy) or JSON-RPC **-32602** (stdio/WebSocket).

## Isolation guarantees

| Subsystem | Isolation mechanism |
|-----------|---------------------|
| Circuit breakers | Separate `CircuitBreaker` per `(tenantId, serverName)` |
| Rate limits (Redis) | Keys `tenant:{tenantId}:...` |
| Rate limits (in-process) | Tenant prefix on LRU keys |
| OAuth sessions | Session + nonce keys namespaced by tenant |
| DPoP jti store | Redis/in-memory keys include tenant |
| Attack learning (file) | `~/.mcp-guardian/tenants/{tenantId}/` |
| Attack learning (PG) | `ai_attack_learning_state_shared.tenant_id` PK |
| SQLite call records | `call_records.tenant_id` column + read filter |
| SQLite cost / security / health | `tenant_id` on `cost_records`, `security_scans`, `health_checks` |
| PG audit trail | `unified_audit_trail.tenant_id` (migration 004) |
| PG cost / security / health | `tenant_id` on local + unified tables (migration 005) |
| Dashboard API rate limit | Per-tenant + per-IP bucket |

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_TENANT_ID` | `default` | Pod/default tenant when no header/meta |
| `GUARDIAN_MULTI_TENANT_ENABLED` | `false` | Documented flag; enables shared-gateway mode |
| `GUARDIAN_POLICY_ROOT` | `.` | Per-tenant policies at `policy-templates/tenants/{tenantId}/policy.yaml` (fallback: `policies/{tenantId}/policy.yaml`) |
| `GUARDIAN_JWT_TENANT_CLAIM` | `tenant_id` | JWT claim that must match resolved request tenant when multi-tenant mode is on |

## Helm

```yaml
multiTenant:
  enabled: false          # set true for shared gateway
  tenantId: ""            # optional pod default (GUARDIAN_TENANT_ID)
```

See `deploy/helm/mcp-guardian/values.yaml`.

## GDPR erasure

```typescript
// All tenants
db.eraseAllAuditData();

// Single tenant (call_records, cost_records, security_scans, health_checks)
db.eraseAllAuditData('acme-corp');
```

## Batch scans (CLI / MCP stdio server)

CLI commands `scan`, `audit`, `health`, and `report` accept `--tenant <id>` and stamp rows with that tenant (or `GUARDIAN_TENANT_ID` / `default`).

When `GUARDIAN_MULTI_TENANT_ENABLED=true`, batch scans require `--tenant` or `GUARDIAN_TENANT_ID`.

The MCP stdio server (`src/index.ts`) uses `GUARDIAN_TENANT_ID` for reads and writes.

## SecurityScanner

`SecurityScanner` is stateless — it does not embed a tenant id in scan results. Tenant isolation is applied at **write** sites: CLI/`report`, MCP tools, and `runPreflightScanAndHealth()` (uses `resolveTenantId()` from env).

## JWT tenant binding

When `GUARDIAN_MULTI_TENANT_ENABLED=true`, OAuth JWTs and dashboard session tokens must agree with the resolved request tenant:

- Proxy: after OIDC validation, `agentIdentity.tenantId` (from `GUARDIAN_JWT_TENANT_CLAIM`, default `tenant_id`) must equal `X-Guardian-Tenant` / `_meta.tenantId`.
- Dashboard: session cookie payload includes `tenant_id`; mutating API calls reject header/cookie mismatches.

## Per-tenant policy ACL

Override base policy per tenant:

```text
policy-templates/tenants/acme-corp/policy.yaml
```

`TenantPolicyRegistry` merges tenant rules onto `default-policy.yaml`. RBAC rules may include:

```yaml
rbac:
  tenants: [acme-corp]
```

## Multi-replica policy cache

When running multiple Guardian replicas behind a load balancer, enable distributed policy evaluation caching:

```bash
export REDIS_URL=redis://redis:6379
export GUARDIAN_POLICY_EVAL_CACHE=true
export GUARDIAN_POLICY_EVAL_CACHE_TTL_MS=5000
```

Cache keys: `policy-eval:{tenantId}:{serverName}:{toolName}:{argsHash}`. Mirrors the OPA LRU pattern in `src/policy/opa-policy.ts`. Disable with `GUARDIAN_POLICY_EVAL_CACHE=false`.

Prometheus metrics include `tenant_id` on `mcp_guardian_requests_total`, `mcp_guardian_blocked_total`, and `mcp_guardian_proxy_latency_ms` for per-tenant dashboards.

Per-tenant spend caps:

```bash
export GUARDIAN_TENANT_DAILY_BUDGET_JSON='{"acme-corp":100,"beta":25}'
export GUARDIAN_TENANT_SEMANTIC_JSON='{"acme-corp":{"syncResponse":true,"asyncAudit":true},"beta":{"strict":true}}'
```

## Limits

- **Not** full network/data-plane isolation — tenants share process memory, SQLite file, and Redis instance unless you deploy separate deployments/namespaces.
- Policy overrides are file-based merges in-process; hot-reload applies to the base policy watcher, not every tenant file automatically.
- Dashboard and TUI list/metric APIs scope to the resolved tenant (`X-Guardian-Tenant` / `X-Tenant-Id` on HTTP, `GUARDIAN_TENANT_ID` for TUI/CLI).
- Dashboard WebSocket clients send `tenantId` on `subscribe`; live metrics/audit pushes are per connection.
- Security-swarm artifacts and visuals data live under `reports/tenants/{tenantId}/security-swarm/` (legacy `reports/security-swarm/` remains for `default` until migrated).
- PostgreSQL `aggregated_metrics` remains instance-global; tenant-scoped PG aggregates use `unified_*` tables via `AuditTrailSync.getAggregatedMetrics(tenantId)`.

## API

`GET /api/admin/tenant` returns resolved tenant, source (`env` | `header`), and multi-tenant mode flag.

## Production pilot checklist

Run after enabling multi-tenant mode in a staging cluster:

1. Issue JWTs with `tenant_id` (or `GUARDIAN_JWT_TENANT_CLAIM`) for two tenants (`acme`, `beta`).
2. Dashboard login — confirm tenant bar is read-only when session-bound; `X-Guardian-Tenant` cannot override JWT tenant.
3. `GET /api/metrics` and `/api/audit` with each tenant header — rows must not cross tenants.
4. WebSocket subscribe with `{ "type": "subscribe", "tenantId": "acme" }` — live metrics exclude `beta` traffic.
5. Trigger security swarm for `acme` — artifacts under `reports/tenants/acme/security-swarm/` only.
6. Automated regression: `pnpm exec vitest run tests/dashboard/dashboard-multi-tenant.test.ts`.

```bash
export GUARDIAN_MULTI_TENANT_ENABLED=true
export DASHBOARD_JWT_SECRET=...   # or DASHBOARD_API_KEY + GUARDIAN_DASHBOARD_ROLES
pnpm enterprise:preflight
```
