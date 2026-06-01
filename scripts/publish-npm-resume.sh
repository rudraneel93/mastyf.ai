#!/usr/bin/env bash
# Finish a partial npm publish (skip versions already on registry).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/publish-npm-all.sh"
