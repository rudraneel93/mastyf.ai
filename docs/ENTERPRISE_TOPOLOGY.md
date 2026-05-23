# Enterprise Multi-Instance Topology

Federated dashboard data plane for N proxy replicas sharing one PostgreSQL aggregation layer.

## Architecture (Phase 1)

```text
  Replica A (SQLite) ──AuditTrailSync──┐
  Replica B (SQLite) ──AuditTrailSync──┼──► PostgreSQL unified_audit_trail
  Replica C (SQLite) ──AuditTrailSync──┘              │
                                                      ▼
                                            Dashboard (UnifiedDataReader)
```

Each proxy runs local `history.db` for low-latency writes. When `GUARDIAN_AUDIT_SYNC_ENABLED=true` and `DATABASE_URL` points at shared Postgres, `AuditTrailSync` incrementally pushes call records (block/pass, cost, rule metadata) into `unified_audit_trail`.

The dashboard host reads federated charts via `UnifiedDataReader` when:

- `GUARDIAN_DASHBOARD_DATA_SOURCE=auto` (default) and audit sync is enabled, or
- `GUARDIAN_DASHBOARD_DATA_SOURCE=unified`

## Environment

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Shared Postgres (proxies sync + dashboard reads) |
| `GUARDIAN_AUDIT_SYNC_ENABLED=true` | Enable proxy → PG sync |
| `GUARDIAN_DASHBOARD_DATA_SOURCE` | `auto` \| `unified` \| `local` \| `fleet` |
| `GUARDIAN_FLEET_DB_PATHS` | Comma-separated SQLite paths (fleet merge fallback) |
| `GUARDIAN_INSTANCE_ID` | Stable instance id in unified tables |
| `GUARDIAN_REGION` | Region label on `guardian_instances.metadata` |

## Verification

1. Start two proxies with distinct `GUARDIAN_INSTANCE_ID`, same `DATABASE_URL`, sync enabled.
2. Dashboard with `GUARDIAN_DASHBOARD_DATA_SOURCE=auto` — Overview KPIs should equal sum of both replicas.
3. Fleet tab lists both instances; chart APIs return `meta.dataSources: ['unified_audit_trail']`.

## Control plane (Phase 2)

Set on self-hosted Guardian:

```bash
GUARDIAN_CONTROL_PLANE_URL=https://your-cloud.example.com
GUARDIAN_CLOUD_API_KEY=gcp_...
GUARDIAN_POLICY_SYNC_ENABLED=true  # default on when API key set
```

- Heartbeat: `POST /api/v1/instances/heartbeat` every 60s
- Policy: polls cloud `GET /api/v1/policy` (version header) → tenant policy YAML hot-reload

Cloud fleet console: `/dashboard/fleet`

## Multi-region (Phase 3)

- `GUARDIAN_MULTI_REGION_MODE=active-active` — per-region Redis counters + optional global cap
- `GUARDIAN_DPOP_REDIS_URL` — cross-region DPoP jti dedup (falls back to `REDIS_URL`)
- `GUARDIAN_GLOBAL_RATE_LIMIT_REDIS_URL` + `GUARDIAN_GLOBAL_RATE_LIMIT_MAX`
- Dashboard region filter: `?region=eu-west-1` on chart APIs; region selector in UI

Preflight: `pnpm enterprise:preflight:multi-region`

See also [MULTI_REGION.md](./MULTI_REGION.md), [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md).
