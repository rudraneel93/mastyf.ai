#!/usr/bin/env bash
export MASTYF_AI_DB_PATH="/private/tmp/mastyf-ai-server.db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; exec node "$(dirname "$SCRIPT_DIR")/dist/index.js" "$@"