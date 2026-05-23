# Database operations

Postgres is recommended for multi-replica Guardian deployments. SQLite remains the default for single-node installs.

## Connection pooling (PgBouncer)

Route `DATABASE_URL` through PgBouncer on port **6432**, not direct Postgres `:5432`.

Recommended settings (see `deploy/helm/mcp-guardian/templates/pgbouncer-configmap.yaml`):

| Setting | Value | Why |
|---------|-------|-----|
| `pool_mode` | `transaction` | Releases server connections after each transaction |
| `server_idle_timeout` | `300` | Reclaim idle upstream connections (seconds) |
| `default_pool_size` | `20` | Per-database pool size |

Set `GUARDIAN_REQUIRE_PGBOUNCER=true` in enterprise Helm overlay to fail startup when the URL is not pooler-shaped.

## `call_records` partitioning (PostgreSQL 14+)

Large tenants can grow `call_records` beyond tens of millions of rows. Apply optional migration `src/database/migrations/007-call-records-partitioning.sql` during a maintenance window:

1. Create monthly partitions, e.g. `call_records_2026_05 FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')`.
2. Ensure index `idx_call_records_tenant_recorded` exists (included in migration).
3. Archive cold partitions to object storage with `pg_dump -t call_records_YYYY_MM` before `DROP TABLE`.

Guardian’s migration runner applies the index automatically; **partition DDL is operator-managed** because it requires calendar-specific bounds.

Monthly partition helper (dry-run first):

```bash
node scripts/postgres-partition-maintenance.mjs --dry-run
DATABASE_URL=postgresql://... node scripts/postgres-partition-maintenance.mjs
```

## Automated backups

| Backend | Helm template | Notes |
|---------|---------------|-------|
| SQLite | `templates/backup-cronjob.yaml` | Copies `history.db` to backup PVC |
| Postgres | `templates/postgres-backup-cronjob.yaml` | `pg_basebackup` tarball; retention via `backup.retentionDays` |

Enable with `backup.enabled: true` in values. For Postgres, configure `backup.postgresHost`, secret, and backup PVC.

### Disaster recovery (restore)

1. Scale Guardian replicas to 0 (or stop writes).
2. Restore from latest `pg_basebackup` tarball on the backup PVC:

```bash
# Example — adjust paths to your cluster PVC mount
tar -xzf /backup/base-YYYYMMDD-HHMMSS.tar.gz -C /var/lib/postgresql/data
```

3. Start Postgres, verify `SELECT COUNT(*) FROM call_records;` per tenant.
4. Re-run migrations if needed: Guardian applies pending `src/database/migrations/*.sql` on startup.
5. Scale Guardian back up; confirm `/readyz` and `pnpm enterprise:preflight`.

Document RTO/RPO in your runbook; default Helm retention is `backup.retentionDays: 7`.

## Row-level security (multi-tenant Postgres)

```bash
export GUARDIAN_PG_RLS_ENABLED=true
```

Requires migrations `006-tenant-rls.sql` and `008-tenant-rls-extended.sql`. Guardian sets `SET LOCAL app.tenant_id` on tenant-scoped queries in `postgres-db.ts`.

## Scale validation

Run concurrent insert/read smoke against Postgres:

```bash
DATABASE_URL=postgres://... SCALE_TEST_CONCURRENCY=50 pnpm test:scale-postgres
```

Use this in release CI or pre-production gates; results are documented in `reports/enterprise-mcp-tests-31/gap-matrix.md`.
