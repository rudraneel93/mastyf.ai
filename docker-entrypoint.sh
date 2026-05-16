#!/bin/sh
set -e
# Named volumes mount as root; app runs as appuser (uid 1001). K8s uses fsGroup instead.
mkdir -p /data
chown -R appuser:appgroup /data
exec su-exec appuser:appgroup "$@"
