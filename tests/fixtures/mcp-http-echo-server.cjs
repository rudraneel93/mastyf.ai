#!/usr/bin/env node
/**
 * Minimal MCP-over-HTTP echo server for integration tests.
 * POST /mcp — same JSON-RPC surface as benchmarks/fixtures/echo-server.cjs (stdio).
 * tools/call returns arguments echoed in result.content (no hardcoded responses).
 */
const http = require('http');

const host = process.env.MCP_ECHO_HOST || '127.0.0.1';
const port = Number(process.env.MCP_ECHO_PORT || process.argv[2] || 0);

function reply(msg) {
  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'mcp-http-echo', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    };
  }
  if (msg.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: [
          {
            name: 'echo',
            description: 'Echo arguments as JSON text',
            inputSchema: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        ],
      },
    };
  }
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
    error: { code: -32601, message: 'Method not found: ' + msg.method },
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url || !req.url.startsWith('/mcp')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try {
      const msg = JSON.parse(Buffer.concat(chunks).toString());
      const out = reply(msg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
    }
  });
});

server.listen(port, host, () => {
  const addr = server.address();
  const p = typeof addr === 'object' && addr ? addr.port : port;
  process.stdout.write('READY:' + p + '\n');
});
