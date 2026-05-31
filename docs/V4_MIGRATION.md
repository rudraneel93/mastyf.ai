# Migrating MCP Guardian v3.4 → v4.0 (Industry Standard)

v4.0 adds certification, MTX threat mesh, benchmark scorecards, intent binding, sandbox tiers, and transport-parity lifecycle guards.

## 1. Database migration

Migration `012-industry-standard.sql` runs automatically on startup when using `history.db`. No manual step for SQLite deployments.

For Postgres cloud deployments, apply `apps/cloud/db/migrations/010_industry_standard.sql`.

## 2. Policy YAML

Add optional top-level policy keys:

```yaml
policy:
  require_certification: gold   # bronze | silver | gold | platinum
  default_sandbox_tier: shadow    # shadow | redact | allow
```

Certification enforcement requires the agentic container (`GUARDIAN_AGENTIC_ENABLED` not `false`).

## 3. Environment variables

| Variable | Purpose |
|----------|---------|
| `GUARDIAN_THREAT_MESH_ENABLED=true` | Enable local MTX mesh |
| `GUARDIAN_THREAT_MESH_RELAY_URL` | Cloud relay for federated MTX |
| `GUARDIAN_THREAT_MESH_RELAY_API_KEY` | Relay auth |
| `GUARDIAN_FUZZ_TARGET` | Live transport fuzz URL |
| `GUARDIAN_BENCH_RUN_HARNESS=true` | Run harness before `mcp-guardian bench` |
| `GUARDIAN_POLICY_SIM_GATE=false` | Disable simulation gate for policy apply |
| `GUARDIAN_COMPLIANCE_CRON_INTERVAL=24h` | Compliance evidence schedule |

## 4. New MCP tools

- `list_certified_servers`
- `verify_certification`
- `declare_intent`

## 5. CLI

```bash
mcp-guardian bench --run-harness --persist --profile enterprise
```

## 6. Dashboard

Agentic workspace **Trust** tab shows certification badges; **Operations** shows chain graph, capability graph, sandbox tier matrix, and playbook approvals.

## 7. Plugin SDK

`@mcp-guardian/plugin-sdk` v4 exports `exportMtxRecord()` and `submitCertificationAttestation()` hooks.

## 8. Breaking changes

- Shadow sandbox tier **blocks** forwarding (v3.4 logged only).
- `applySuggestionToPolicy()` is now **async** and runs simulation by default.
- Default policy includes `require_certification: gold` — certify servers or lower the requirement.
