# HIPAA-oriented audit trail (immutable hash chain)

MCP Guardian does **not** replace a full HIPAA compliance program. For regulated workloads, combine:

1. **Policy overlay** — `policy-templates/hipaa-compliance.yaml` (PHI pattern blocks including ICD-10/NDC).
2. **Immutable audit chain** — enable append-only hash chaining for dashboard and SIEM events.

The HIPAA template’s `log_to: elasticsearch` field is **customer SIEM wiring** — use `GUARDIAN_AUDIT_HASH_CHAIN_SIEM=true` and ship chained JSONL to Elasticsearch frozen tier or your WORM store.

## Enable immutable audit

```bash
export GUARDIAN_AUDIT_HASH_CHAIN=true
export GUARDIAN_AUDIT_HASH_CHAIN_SIEM=true
# optional custom path:
# export GUARDIAN_AUDIT_HASH_CHAIN_SIEM_LOG=/var/log/mcp-guardian/siem-chain.jsonl
```

Enterprise Helm (`values-enterprise.yaml`) sets these by default.

## What is chained

- Dashboard API access (`dashboard_access`) — `{ userId, tenantId, endpoint, method, status, ip, timestamp }`
- Policy and security events when wired through `appendSiemChainedEvent`

Each record includes `prev_hash` and `record_hash` (SHA-256 chain). Tampering breaks verification.

## Postgres tenant isolation

With `DB_TYPE=postgres`:

```bash
export GUARDIAN_PG_RLS_ENABLED=true
```

Applies migrations `006-tenant-rls.sql` and `008-tenant-rls-extended.sql`. The app sets `SET LOCAL app.tenant_id` per query when `tenantId` is known.

## Verification

```bash
pnpm enterprise:preflight
# Review per-tenant access logs:
# ~/.mcp-guardian/tenants/<tenant-id>/access.jsonl
```

Ship chained logs to your SIEM/WORM store for long-term retention (S3 Object Lock, Elasticsearch frozen tier, etc.).
