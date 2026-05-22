# Multi-tenant staging pilot — sign-off

Generated for procurement / security review handoff (Phase 5.3).

## Environment

| Field | Value |
|-------|--------|
| Release | 2.9.4 |
| Cluster | _staging URL_ |
| Postgres migrations | 004, 005 applied |
| Redis | enabled |
| `GUARDIAN_MULTI_TENANT_ENABLED` | true |

## Checklist (docs/MULTI_TENANCY.md § Production pilot)

| Step | Result | Evidence |
|------|--------|----------|
| 1. JWTs for acme + beta | ☑ Pass | `node scripts/issue-pilot-jwt.mjs` (automated) |
| 2. Dashboard login — JWT wins over headers | ☐ Manual | _screenshot / notes — run on live staging dashboard_ |
| 3. `/api/metrics` + `/api/audit` isolation | ☑ Partial | `dashboard-multi-tenant.test.ts` + live curl when `PILOT_BASE_URL` set |
| 4. WebSocket subscribe tenantId=acme | ☑ Pass | covered in `dashboard-multi-tenant.test.ts` |
| 5. Swarm artifacts under `reports/tenants/acme/` | ☐ Manual | run `GUARDIAN_TENANT_ID=acme pnpm security-swarm:fast` on staging |
| 6. `dashboard-multi-tenant.test.ts` | ☑ Pass | vitest 3/3 |
| `pnpm enterprise:pilot` | ☑ Pass | automated checks |
| `pnpm enterprise:preflight` | ☑ Pass | zero FAIL (WARN ok for local) |
| `pnpm enterprise:cutover` | ☑ Pass | automated checks |

## Automated verification (local/CI)

```bash
pnpm exec vitest run tests/dashboard/dashboard-multi-tenant.test.ts
env -u DASHBOARD_AUTH_DISABLED pnpm enterprise:preflight
pnpm enterprise:pilot
pnpm enterprise:cutover
pnpm enterprise:compliance-report
pnpm enterprise:evidence-pack
```

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Security | | |
| Ops | | |
