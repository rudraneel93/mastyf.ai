#!/bin/bash
# End-to-end test: start proxy with dashboard, send test traffic, verify metrics
set -e

echo "=== Building ==="
npm run build

echo "=== Starting proxy with test traffic ==="
# Start proxy in background, pipe 5 tools/call through stdin, wait, verify
DASHBOARD_ENABLED=true METRICS_ENABLED=true node dist/cli.js proxy --policy ./default-policy.yaml --blocking-mode warn &
PROXY_PID=$!
sleep 4

echo "=== Sending 10 tools/call through proxy ==="
for i in $(seq 1 10); do
  echo "{\"jsonrpc\":\"2.0\",\"id\":\"t$i\",\"method\":\"tools/call\",\"params\":{\"name\":\"search\",\"arguments\":{\"query\":\"test $i\"}}}"
done | while read line; do
  echo "$line" > /proc/$PROXY_PID/fd/0 2>/dev/null || true
done

# Alternative: use a file descriptor trick
for i in $(seq 1 10); do
  echo "{\"jsonrpc\":\"2.0\",\"id\":\"t$i\",\"method\":\"tools/call\",\"params\":{\"name\":\"search\",\"arguments\":{\"query\":\"test $i\"}}}"
done > /tmp/test-traffic.json

sleep 3

echo "=== Checking dashboard metrics ==="
echo "--- /api/policy ---"
curl -s http://localhost:4000/api/policy

echo ""
echo "--- /metrics (mcp_guardian_*) ---"
curl -s http://localhost:4000/metrics | grep "mcp_guardian" | head -20

echo ""
echo "Done. Kill proxy: kill $PROXY_PID"
kill $PROXY_PID 2>/dev/null