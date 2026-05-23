# MCP Guardian Compliance Mapping

| Control area | Implementation |
|--------------|----------------|
| Audit logging | Structured JSON via pino; SIEM via `MCP_GUARDIAN_SIEM_*` env vars |
| Policy changes | `POLICY_AUDIT_ENABLED=true` → JSONL in PolicyAuditor |
| Authentication | OAuth 2.1 / OIDC JWT validation |
| Authorization | Policy RBAC (`rules[].rbac`) |
| HA state | `REDIS_URL` + optional `DB_TYPE=postgres` |
| DPoP replay (multi-replica) | `REDIS_URL` → Redis `SET NX` jti store (`dpop-nonce-store.ts`) |
| Secrets | `GUARDIAN_SECRET_PROVIDER` (env, Vault, AWS) |
| Data retention | 30-day TTL auto-purge of `call_records` (`history-db.ts` `purge()`) |
| GDPR erasure | `HistoryDatabase.eraseAllAuditData()` + operator SIEM purge |
| HIPAA PHI patterns (template) | `policy-templates/hipaa-compliance.yaml` — merge with base policy |
| PCI cardholder masking (template) | `policy-templates/pci-dss-masking.yaml` |
| Per-tenant audit isolation | `~/.mcp-guardian/tenants/{tenantId}/policy-audit.jsonl`; optional Postgres RLS (`006-tenant-rls.sql`) |
| Dashboard access trail | `GET /api/admin/access-log` (admin / tenant-admin) |

## Data retention (default)

- **call_records**: Deleted after **30 days** via hourly `purge()` when using on-disk `history.db`
- **cost_records / security_scans / health_checks**: Not TTL-purged automatically — include in erasure workflow or extend `purge()` for your policy
- Override path: `MCP_GUARDIAN_DB_PATH` (all processes must share the same file for a single tenant)

## GDPR Article 17 (right to erasure)

1. Stop proxy/TUI writers using the DB file.
2. Run erasure on the canonical DB:

```typescript
import { HistoryDatabase } from '@mcp-guardian/server/dist/database/history-db.js';

const db = new HistoryDatabase(); // uses MCP_GUARDIAN_DB_PATH / ~/.mcp-guardian/history.db
const removed = db.eraseAllAuditData();
console.log(removed);
db.close();
```

3. Purge replicated logs (CloudWatch, Datadog, Splunk) per your DPA.
4. For Postgres HA (`DB_TYPE=postgres`), run equivalent `DELETE` on all audit tables in your schema.
5. Run `VACUUM` on SQLite after erasure; **WAL/previous backups may still retain deleted pages** until rotated — purge backup snapshots and SIEM copies per your DPA. Guardian does not certify forensic non-recovery without your backup/WAL controls.

## HIPAA §164.312(a)(2)(i) — encryption at rest

`history.db` is **plain SQLite** in the OSS package. Acceptable operator controls:

| Approach | Notes |
|----------|--------|
| Encrypted volume (EBS, LUKS, FileVault) | Recommended default |
| SQLCipher build of SQLite | Replace `better-sqlite3` binding in a private fork — not shipped here |
| KMS envelope | Encrypt DB file at rest via cloud KMS + mount |

Guardian does not manage keys; document your KMS owner in your HIPAA BAA evidence pack.

## Honest gaps (not certified without your controls)

| Requirement | Status |
|-------------|--------|
| **HIPAA BAA / formal evidence** | Audit events exist; BAA and control evidence are operator-owned |
| **SOC2 evidence pack** | Audit logs exist; append-only SIEM + cryptographic log chaining are operator-owned (not in-box) |
| **SQLCipher in-box** | Not bundled — use volume encryption or custom build |
| **Native Windows MSI** | PowerShell wrapper shipped; MSI installer planned (see `installer/README.md`) |

## Proxy observability events

Integration tests expect these structured events on the stdio proxy path:

| Event | When |
|-------|------|
| `request_forwarded` | Safe tool call forwarded upstream |
| `response_sent` | Upstream JSON-RPC response written to the IDE client |

See [PEN_TEST_SCOPE.md](./PEN_TEST_SCOPE.md) for security assessment scope.
