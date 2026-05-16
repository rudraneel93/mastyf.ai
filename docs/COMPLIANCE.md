# MCP Guardian Compliance Mapping

| Control area | Implementation |
|--------------|----------------|
| Audit logging | Structured JSON via pino; SIEM via `MCP_GUARDIAN_SIEM_*` env vars |
| Policy changes | `POLICY_AUDIT_ENABLED=true` → JSONL in PolicyAuditor |
| Authentication | OAuth 2.1 / OIDC JWT validation |
| Authorization | Policy RBAC (`rules[].rbac`) |
| HA state | `REDIS_URL` + optional `DB_TYPE=postgres` |
| Secrets | `GUARDIAN_SECRET_PROVIDER` (env, Vault, AWS) |

See [PEN_TEST_SCOPE.md](./PEN_TEST_SCOPE.md) for security assessment scope.
