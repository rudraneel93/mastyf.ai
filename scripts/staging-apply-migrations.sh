#!/usr/bin/env sh
# Apply tenant migrations 004/005 to staging Postgres (DATABASE_URL required).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

for m in 004-tenant-scoping.sql 005-tenant-cost-security-health.sql; do
  echo "[staging] applying $m"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "src/database/migrations/$m"
done

echo "[staging] migrations 004/005 applied"
