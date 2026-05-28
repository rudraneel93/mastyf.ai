#!/bin/sh
set -e
# Container already runs as uid 1001 (see Dockerfile USER).
# Avoid su-exec/setgroups in restricted runtimes.
mkdir -p /data 2>/dev/null || true
exec "$@"
