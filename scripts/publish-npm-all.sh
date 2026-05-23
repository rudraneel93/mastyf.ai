#!/usr/bin/env bash
# Publish all @mcp-guardian packages in dependency order (v3.2.1+).
# Requires: npm login (npm whoami) and OTP if 2FA enabled:
#   NPM_OTP=123456 ./scripts/publish-npm-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OTP_ARGS=()
if [[ -n "${NPM_OTP:-}" ]]; then
  OTP_ARGS=(--otp="$NPM_OTP")
fi

echo "npm user: $(npm whoami)"
echo "Building..."
pnpm install --no-frozen-lockfile
pnpm run build

publish_pkg() {
  local dir="$1"
  echo ""
  echo "=== Publishing $(node -p "require('./${dir}/package.json').name")@$(node -p "require('./${dir}/package.json').version") ==="
  (cd "$dir" && npm publish --access public "${OTP_ARGS[@]}")
}

publish_pkg packages/plugin-sdk
publish_pkg packages/core
npm publish --access public "${OTP_ARGS[@]}"
publish_pkg packages/cli

echo ""
echo "Done. Verify:"
echo "  npm view @mcp-guardian/server version"
echo "  npm view @mcp-guardian/core version"
echo "  npm view @mcp-guardian/plugin-sdk version"
