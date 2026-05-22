#!/usr/bin/env sh
# Transport pilot checklist — run against your real MCP upstreams (SSE, WS, streamable HTTP).
set -e
echo "[transport-pilot] Run integration + proxy roundtrip tests"
pnpm test:integration
pnpm exec vitest run tests/proxy/sse-proxy-server.test.ts
pnpm exec vitest run tests/proxy/websocket-proxy-roundtrip.test.ts
pnpm exec vitest run tests/integration/streamable-http-relay.test.ts --config vitest.integration.config.ts
echo "[transport-pilot] Automated transport matrix passed — validate your upstream URLs in staging manually"
