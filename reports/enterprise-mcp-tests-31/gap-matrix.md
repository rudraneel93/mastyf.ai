# MCP Tests 31 — Gap matrix

**Source:** `/Users/rudraneeldas/Downloads/mcp tests 31` (May 23, 2026, v2.9.6 baseline)  
**Target repo:** mcp-guardian → **v2.10.0+**  
**Last updated:** 2026-05-23

| ID | Sev | Analysis claim | Repo status | Action |
|----|-----|----------------|-------------|--------|
| C1 | CRIT | Response DLP misses encoded secrets | **Done** | `src/utils/response-decode.ts`, `tests/utils/response-dlp-decode.test.ts` |
| C2 | CRIT | Semantic audit exhaustible | **Done** | 10/min cap, 24h LLM cache default, local fallback on rate-limit/LLM failure |
| C3 | CRIT | No LLM circuit breaker | **Done** | Proxy: `semantic-circuit-breaker.ts`; Core: `packages/core/src/semantic-circuit-breaker.ts` |
| C4 | CRIT | Policy regex ReDoS | **Done** | `regex-compile.ts` static analysis + worker-thread eval (prod default) + wall-clock fallback |
| C5 | CRIT | Swarm no step timeout | **Done** | `security-swarm/lib/run-step.mjs` |
| C6 | CRIT | Evasion manifest unsigned | **Done** | HMAC in `evasion-generate.mjs` + verify in `open-corpus-pr.mjs` |
| C7 | CRIT | Unbounded stderr | **Done** | `maxBuffer` + `sanitizeSpawnOutput` |
| H1 | HIGH | Per-tenant audit segregation | **Done** | `tenant-audit-paths.ts` + Postgres RLS (`008-tenant-rls-extended.sql`, `postgres-tenant-session.ts`) |
| H2 | HIGH | Per-tenant cost budgets | **Done** | `tenant-budget.ts` + proxy hook |
| H3 | HIGH | Dashboard access logging | **Done** | `dashboard-access-log.ts` (`userId`, `tenantId`, `endpoint`, `timestamp`) |
| H4 | HIGH | 50-replica scale proof | **Done** | CI enterprise job: `pnpm test:scale-postgres` @ 50 + `pnpm test:scale-proxy` @ 50 replicas |
| H5 | HIGH | Semantic sync response off | **Done** | Production default on; enterprise Helm; opt-out `GUARDIAN_SEMANTIC_SYNC_RESPONSE=false` |
| H6 | HIGH | HIPAA template | **Done** | `policy-templates/hipaa-compliance.yaml` |
| H7 | HIGH | PCI template | **Done** | `policy-templates/pci-dss-masking.yaml` |
| H8 | HIGH | Ollama fallback | **Done** | `packages/core/src/semantic-scanner.ts` |
| H9 | HIGH | Queryable audit API | **Done** | `GET /api/audit` |
| H10 | HIGH | P99 SLO at peak | **Config** | Async semantic + Grafana SLO panel; tune replicas/HPA |
| H11 | HIGH | Swarm agent circuit breaker | **Done** | 3 failures → abort in `run.mjs` |
| H12–H16 | HIGH | Swarm archival/alerting/scale | **Done** | `archive-artifacts.mjs`, `swarm-alert.mjs`, `retention-policy.mjs`, `parallel-steps.mjs`, `swarm-tenant-scale.mjs` |
| M1 | MED | Core semantic backpressure | **Done** | Per-tenant queue cap + skip reasons in `engine.ts` |
| M2 | MED | Core local semantic default | **Done** | `local-semantic-fallback.ts` (default on) |
| M3 | MED | Policy YAML compile cache | **Done** | `policy-engine-cache.ts` |
| M4 | MED | Query result caching | **Done** | `dashboard-query-cache.ts` on cost breakdown |
| M5 | MED | Postgres backup automation | **Done** | `postgres-backup-cronjob.yaml` |
| M6 | MED | call_records partitioning | **Done** | Migration `007` index + `scripts/postgres-partition-maintenance.mjs` |
| M7 | MED | PgBouncer transaction mode | **Done** | `pgbouncer-configmap.yaml`, enterprise values |
| M8 | MED | X-Redaction-Reason header | **Done** | HTTP proxy + `_meta.redaction` stdio |
| M9 | MED | JSON Schema validation | **Done** | `ajv` in `packages/core` schema-scanner |
| M10–M11 | MED | Schema depth/maxLength | **Done** | Recursive `scanProperty` in core |
| M29–M31 | MED | Helm PDB/resources/NetPol | **Done** | `pdb.yaml`, `values-enterprise.yaml`, `networkpolicy.yaml` |
| M33 | MED | Business metrics | **Done** | `attacks_blocked`, `cost_spent`, `semantic_audit_skipped` |
| — | v2.10 | Inbound HTTP/SSE gateway | **Done** | `GUARDIAN_GATEWAY_MODE`, Helm ingress |
| — | v2.10 | WebSocket parity | **Done** | ProxyManager + config `websocket` |
| — | §6.2 | DPoP Redis lock contention | **Done** | `claimDpopJtiLockFree` + jitter (`GUARDIAN_DPOP_LOCK_FREE`) |
| — | §6.3 | HIPAA immutable audit | **Done (product)** | `GUARDIAN_AUDIT_HASH_CHAIN` + [HIPAA_AUDIT_TRAIL.md](../../docs/HIPAA_AUDIT_TRAIL.md) |
| — | §6.3 | SOC2 access logging | **Done (product)** | Dashboard JSONL + SIEM chain; formal SOC2 pack = customer program |
| — | §6.3 | Backup & DR | **Done** | Helm CronJob + restore runbook in `DATABASE_OPERATIONS.md` |
| — | — | FIPS 140-2 validation | **Non-goal** | Use FIPS-enabled crypto modules in your platform |
| — | — | Multi-region Redis AA | **Non-goal** | `ENTERPRISE_ROADMAP.md` P3 |
| — | — | GxP controlled vocabulary | **Done** | `policy-templates/gxp-compliance.yaml` |
| — | — | Multi-region failover tests | **Done** | `tests/utils/multi-region-failover.test.ts` + preflight script |
| — | — | Cost optimization dashboard | **Done** | `GET /api/cost/recommendations` + CostGovernancePanel |
| — | — | Core engine circuit → local fallback | **Done** | `packages/core/src/engine.ts` |
| — | — | Policy unsafe regex fail-closed | **Done** | `GUARDIAN_POLICY_REJECT_UNSAFE_REGEX` |
| — | — | Session rotate-on-use audit | **Done** | `session-cache.ts` → `appendSessionRotateAudit` |
| — | — | Semantic 1000-burst regression | **Done** | `tests/ai/semantic-burst-rate-limit.test.ts` |
| — | — | Dollar-based semantic rate limit | **Done** | `GUARDIAN_SEMANTIC_LLM_MAX_USD_PER_MIN` in `semantic-llm-rate-limit.ts` |
| — | — | Ollama local model inference (full) | **Partial** | Ollama API + core heuristics; not embedded model |

**Release:** v2.10.1 = mcp tests 31 closure pass (full analysis implementation). See [MCP_GUARDIAN_COMPREHENSIVE_ANALYSIS.md](./MCP_GUARDIAN_COMPREHENSIVE_ANALYSIS.md).
