# Enterprise analysis remediation — checklist

Source: external comprehensive analysis (May 2026, v2.9.6 baseline).

| Analysis item | Status | Implementation |
|---------------|--------|----------------|
| Response DLP HTML decode | Done | `src/utils/response-decode.ts`, `evaluateResponseDlp` |
| Context-aware redaction | Done | `redactLabeledSecrets` in `response-dlp.ts` |
| Semantic circuit breaker | Done | `src/ai/semantic-circuit-breaker.ts` |
| Per-tenant LLM rate limit | Done | `src/ai/semantic-llm-rate-limit.ts` |
| Tenant + mode LLM cache keys | Done | `hashSemanticAuditKey` |
| Regex runtime budget | Done | `GUARDIAN_REGEX_EVAL_TIMEOUT_MS` in `regex-compile.ts` |
| Upstream timeout env | Done | `src/utils/upstream-timeout.ts` |
| Per-tenant audit paths | Done | `src/audit/tenant-audit-paths.ts` |
| Dashboard access log | Done | `src/audit/dashboard-access-log.ts`, `GET /api/admin/access-log` |
| Queryable audit API | Done | `GET /api/audit?kind=policy\|access\|session` |
| Session rotation audit | Done | `appendSessionRotateAudit` on login |
| HIPAA / PCI templates | Done | `policy-templates/hipaa-compliance.yaml`, `pci-dss-masking.yaml` |
| Postgres RLS (optional) | Done | `006-tenant-rls.sql` |
| Core schema recursion | Done | `packages/core/src/schema-scanner.ts` |
| Core semantic Ollama + timeout | Done | `packages/core/src/semantic-scanner.ts` |
| Core semantic circuit breaker | Done | `packages/core/src/semantic-circuit-breaker.ts` + `engine.ts` |
| Core local semantic fallback | Done | `packages/core/src/local-semantic-fallback.ts` |
| Per-tenant core semantic queue | Done | `packages/core/src/semantic-queue.ts` |
| Policy compile cache | Done | `src/policy/policy-engine-cache.ts` |
| Dashboard query cache | Done | `src/utils/dashboard-query-cache.ts` |
| Postgres pg_basebackup CronJob | Done | `deploy/helm/.../postgres-backup-cronjob.yaml` |
| PgBouncer ConfigMap | Done | `deploy/helm/.../pgbouncer-configmap.yaml` |
| call_records partitioning doc | Done | `docs/DATABASE_OPERATIONS.md`, migration `007` |
| HTTP redaction header | Done | `http-proxy-server.ts` + `formatRedactionHeader` |
| Grafana SLO compliance panel | Done | `deploy/grafana/mcp-guardian-slo.json` |
| Attack block metrics | Done | `mcp_guardian_attacks_blocked_total` |
| Cost breakdown API | Done | `GET /api/cost/breakdown` |
| Scale Postgres script | Done | `pnpm test:scale-postgres` |
| Helm PDB when replicas > 1 | Done | `templates/pdb.yaml` |

Already shipped before this pass (documented only): ReDoS compile checks, response gate on all transports, local semantic fallback, Redis Cluster client, enterprise Helm overlay.

Verification (local, May 23 2026):
- `pnpm test` — 169 files, 1055 tests passed
- `pnpm test:integration` — 6 files, 54 tests passed
- `pnpm build` — pass (fixed `semantic-circuit-breaker` Logger.warn + `proxy-server` CVE `requestTenantId`)
- `pnpm security-swarm:fast` — PASS (corpus 228, parity 437/437, 0 bypasses)

**Release:** v2.10.0 = mcp tests 31 closure (verify shipped fixes, swarm hardening, core ajv, tenant budget on hot path, gateway + WebSocket transport). See `reports/enterprise-mcp-tests-31/gap-matrix.md`.
