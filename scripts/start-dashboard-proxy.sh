#!/usr/bin/env sh
# Start MCP Guardian proxy with dashboard SPA + live metrics from MCP_GUARDIAN_DB_PATH.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f dist/cli.js ]; then
  echo "[dashboard-proxy] Building dist…" >&2
  pnpm build
elif [ ! -f dist/utils/dashboard-server.js ] \
  || [ src/utils/dashboard-server.ts -nt dist/utils/dashboard-server.js ]; then
  echo "[dashboard-proxy] Rebuilding dist (dashboard API changed)…" >&2
  pnpm exec tsc --project tsconfig.json
fi

if [ ! -f deploy/dashboard-spa/out/index.html ]; then
  echo "[dashboard-proxy] Building dashboard SPA…" >&2
  pnpm dashboard:build
fi

# Stop standalone dashboard:serve if it holds :4000
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"${DASHBOARD_PORT:-4000}" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "[dashboard-proxy] Stopping process(es) on port ${DASHBOARD_PORT:-4000}: $PIDS" >&2
    kill $PIDS 2>/dev/null || true
    sleep 1
  fi
fi

export MCP_GUARDIAN_DB_PATH="${MCP_GUARDIAN_DB_PATH:-$HOME/.mcp-guardian/history.db}"
export DASHBOARD_ENABLED=true
export DASHBOARD_AUTH_DISABLED="${DASHBOARD_AUTH_DISABLED:-true}"
export GUARDIAN_WS_ENABLED="${GUARDIAN_WS_ENABLED:-true}"
export METRICS_ENABLED="${METRICS_ENABLED:-true}"
export DASHBOARD_PORT="${DASHBOARD_PORT:-4000}"
export METRICS_PORT="${METRICS_PORT:-9090}"

CONFIG="${1:-deploy/dashboard-proxy-mcp.json}"
POLICY="${2:-policy-demo.yaml}"

echo "[dashboard-proxy] DB: $MCP_GUARDIAN_DB_PATH" >&2
echo "[dashboard-proxy] Dashboard: http://localhost:${DASHBOARD_PORT}/" >&2
echo "[dashboard-proxy] Config: $CONFIG  Policy: $POLICY" >&2

exec node dist/cli.js proxy --config "$CONFIG" --policy "$POLICY" --blocking-mode audit
