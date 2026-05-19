#!/usr/bin/env node
/**
 * Minimal stdio MCP fixture — tools/list + read_file (no network).
 */
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({ input: process.stdin, terminal: false });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const id = msg.id;
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'filesystem-fixture', version: '1.0.0' },
      },
    });
    return;
  }
  if (msg.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'read_file',
            description: 'Read a file from fixture workspace',
            inputSchema: {
              type: 'object',
              properties: { path: { type: 'string' } },
              required: ['path'],
            },
          },
        ],
      },
    });
    return;
  }
  if (msg.method === 'tools/call') {
    const name = msg.params?.name;
    const args = msg.params?.arguments || {};
    if (name === 'read_file' && args.path) {
      const base = path.join(__dirname, 'fs-workspace');
      const target = path.resolve(base, String(args.path));
      if (!target.startsWith(base)) {
        send({
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: 'path outside workspace' },
        });
        return;
      }
      const content = fs.readFileSync(target, 'utf-8');
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: content }] } });
      return;
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'unknown tool' } });
    return;
  }
  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, result: {} });
  }
});
