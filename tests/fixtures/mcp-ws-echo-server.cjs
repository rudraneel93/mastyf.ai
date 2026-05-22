#!/usr/bin/env node
/**
 * Minimal MCP-over-WebSocket echo server for integration tests.
 * Echoes tools/call arguments in result.content (same semantics as echo-server.cjs).
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const host = process.env.MCP_ECHO_HOST || '127.0.0.1';
const port = Number(process.env.MCP_ECHO_PORT || process.argv[2] || 0);

function reply(msg) {
  if (msg.method === 'tools/call') {
    const args = (msg.params && msg.params.arguments) || {};
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(args) }],
      },
    };
  }
  return {
    jsonrpc: '2.0',
    id: msg.id,
    result: { ok: true },
  };
}

const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data));
      ws.send(JSON.stringify(reply(msg)));
    } catch (e) {
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: String(e && e.message ? e.message : e) },
        }),
      );
    }
  });
});

httpServer.listen(port, host, () => {
  const addr = httpServer.address();
  const p = typeof addr === 'object' && addr ? addr.port : port;
  process.stdout.write('READY:' + p + '\n');
});
