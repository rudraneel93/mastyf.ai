# Multi-region deployment

MCP Guardian supports **active-passive** multi-region failover — not active-active replication of a single SQLite file.

## Region labeling

Set `GUARDIAN_REGION` on every proxy/dashboard replica:

```bash
export GUARDIAN_REGION=us-east-1
```

Region appears in:

- Prometheus rate-limit and semantic-audit metrics (`region` label)
- Redis rate-limit key prefix: `mcp_guardian:ratelimit:{region}:…`
- Structured logs for async semantic audit flags

## Shared rate limiting (Redis)

With `REDIS_URL`, all replicas in a region share atomic `INCR` counters for `maxCallsPerMinute` rules.

Optional window lock (active-passive coordination):

```bash
export GUARDIAN_RATE_LIMIT_DISTRIBUTED_LOCK=true
```

Uses Redis `SET key NX PX` so only one replica “owns” a window boundary when you run paired primary/standby proxies.

## Active-passive failover (honest)

| Component | Multi-region behavior |
|-----------|----------------------|
| **SQLite `history.db`** | Per-host; not replicated. Failover = new empty DB or restore from backup. |
| **PostgreSQL `DATABASE_URL`** | Single primary per region; use your cloud DR (RDS cross-region read replica, etc.). |
| **Redis `REDIS_URL`** | Global or per-region — rate limits are consistent only within the Redis cluster you point at. |
| **Policy YAML** | Ship the same file to all regions (GitOps). `GUARDIAN_HTTP_TOOLS_POLICY=true` merges SSRF template everywhere. |

**Not supported:** active-active writes to one SQLite path across regions, or automatic cross-region Guardian control plane.

## Recommended topology

1. **Primary region** — proxy fleet + Postgres + Redis + dashboard (`DASHBOARD_ENABLED=true`).
2. **Standby region** — same Helm values with `GUARDIAN_REGION=eu-west-1`, DNS/ingress failover to standby Postgres/Redis endpoints after DR promotion.
3. **Fleet view** — `mcp-guardian fleet status` with `DATABASE_URL` reads `guardian_instances` aggregated by `AuditTrailSync`.

See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) and [SCALE_AND_RESILIENCE.md](SCALE_AND_RESILIENCE.md).
