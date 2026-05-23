# Database migrations

## PostgreSQL (production)

`migration-runner.ts` applies **only `*.sql` files** in this directory in lexicographic order, tracked in `schema_migrations`.

Current SQL migrations:

| File | Purpose |
|------|---------|
| `002-unified-aggregation.sql` | Unified aggregation tables |
| `003-attack-learning-shared.sql` | Shared attack-learning state |
| `004-tenant-scoping.sql` | Tenant columns |
| `005-tenant-cost-security-health.sql` | Cost/security/health tenant scope |
| `006-query-indexes.sql` | Query indexes |
| `006-tenant-rls.sql` | Row-level security (call_records, unified_audit_trail) |
| `007-call-records-partitioning.sql` | Optional partitioning (manual maintenance window) |
| `007-semantic-audit-outcomes.sql` | Semantic audit outcome columns |
| `008-tenant-rls-extended.sql` | Extended RLS policies |
| `009-unified-audit-dedupe.sql` | Audit sync cursors + source_record_id dedupe |

**Version tracking:** Each file’s full basename (without `.sql`) is stored in `schema_migrations.version`. Duplicate numeric prefixes (e.g. two `006-*` files) are allowed but logged as warnings at apply time — both files still run if their version strings differ.

Base schema for PostgreSQL is created inline in `postgres-db.ts` before SQL migrations run.

## Legacy SQLite

`001_initial.ts` and `003_metrics_timeseries.ts` are **SQLite-only** helpers used by the embedded DB path. They are **not** executed by the PostgreSQL runner.
