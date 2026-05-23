#!/usr/bin/env bash
# Apply cloud control-plane SQL migrations (includes 007_fleet_instances.sql).
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/cloud-migrate-production.sh
# Or pull from Vercel first:
#   VERCEL_TOKEN=... ./scripts/cloud-migrate-production.sh --pull-vercel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLOUD="$ROOT/apps/cloud"
VERCEL_CLI="${VERCEL_CLI:-npx vercel@48}"

if [[ "${1:-}" == "--pull-vercel" ]]; then
  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    echo "ERROR: Set VERCEL_TOKEN to pull production DATABASE_URL"
    exit 1
  fi
  cd "$CLOUD"
  $VERCEL_CLI env pull .env.production.local --environment=production --token "$VERCEL_TOKEN" --yes
  set -a
  # shellcheck disable=SC1091
  source .env.production.local
  set +a
  cd "$ROOT"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required (Neon connection string)."
  echo "  DATABASE_URL=postgresql://... pnpm cloud:migrate"
  exit 1
fi

echo "Running cloud migrations..."
pnpm cloud:migrate
echo "Migrations complete. Fleet heartbeat table: guardian_fleet_instances (007_fleet_instances.sql)"
