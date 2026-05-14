#!/usr/bin/env bash
export MCP_GUARDIAN_DB_PATH="/private/tmp/mcp-guardian-server.db"
exec node /Users/rudraneeldas/Desktop/mcp-guardian/dist/index.js "$@"