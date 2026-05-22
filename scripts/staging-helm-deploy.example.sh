#!/usr/bin/env sh
# Example Helm deploy for staging — adjust secrets and URLs.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

helm upgrade --install mcp-guardian ./deploy/helm/mcp-guardian \
  -f deploy/helm/mcp-guardian/values.yaml \
  -f deploy/helm/mcp-guardian/values-enterprise.yaml \
  --set database.url="${DATABASE_URL:?DATABASE_URL required}" \
  --set redis.sentinel.sentinels="${REDIS_SENTINELS:-}" \
  --set secrets.existingSecret="${HELM_EXISTING_SECRET:-mcp-guardian-staging}"

echo "[staging] helm release applied — verify with kubectl get pods"
