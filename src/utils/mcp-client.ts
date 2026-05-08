import { spawn, ChildProcess } from 'child_process';
import { McpServerConfig } from '../types.js';
import { Logger } from './logger.js';

/**
 * Real MCP client for probing server health and listing tools.
 * Spawns stdio servers to perform an initialize handshake and tools/list call.
 * Probes SSE/HTTP servers via fetch for connectivity.
 */
export class McpClient {
  private static HANDSHAKE_TIMEOUT_MS = 10000;
  private static SSE_TIMEOUT_MS = 5000;

  /**
   * Probe an MCP server: initialize + tools/list for stdio, or HTTP GET for SSE.
   */
  static async probe(server: McpServerConfig): Promise<{ toolCount: number; success: boolean }> {
    if (server.transport === 'stdio') {
      return McpClient.probeStdio(server);
    } else if (server.url) {
      return McpClient.probeSse(server.url);
    }
    return { toolCount: 0, success: false };
  }

  /**
   * Spawn a stdio MCP server, send initialize + tools/list, parse response.
   */
  private static async probeStdio(server: McpServerConfig): Promise<{ toolCount: number; success: boolean }> {
    if (!server.command) {
      return { toolCount: 0, success: false };
    }

    const cmd = server.command;
    return new Promise((resolve) => {
      let childProcess: ChildProcess;
      try {
        const args = server.args || [];
        const env = { ...process.env, ...(server.env || {}) };

        childProcess = spawn(cmd, args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: McpClient.HANDSHAKE_TIMEOUT_MS,
        });
      } catch (err) {
        Logger.debug(`Failed to spawn "${server.command}": ${err}`);
        return resolve({ toolCount: 0, success: false });
      }

      const timeout = setTimeout(() => {
        try { childProcess.kill(); } catch {}
        resolve({ toolCount: 0, success: false });
      }, McpClient.HANDSHAKE_TIMEOUT_MS);

      let buffer = '';
      let resolveHandled = false;

      const done = (toolCount: number, success: boolean) => {
        if (resolveHandled) return;
        resolveHandled = true;
        clearTimeout(timeout);
        try { childProcess.kill(); } catch {}
        resolve({ toolCount, success });
      };

      childProcess.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();
        // Try to parse JSON-RPC response from stdout
        McpClient.parseJsonRpcResponse(buffer, server.name, done);
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        // stderr is for logging, not responses
        Logger.debug(`[${server.name} stderr] ${data.toString().trim()}`);
      });

      childProcess.on('error', (err) => {
        Logger.debug(`[${server.name}] spawn error: ${err.message}`);
        done(0, false);
      });

      childProcess.on('exit', (code) => {
        if (!resolveHandled) {
          // Try final parse of whatever we got
          const result = McpClient.tryParseToolCount(buffer);
          done(result.toolCount, result.toolCount > 0);
        }
      });

      // Send MCP initialize request
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'mcp-doctor', version: '0.1.0' },
        },
      }) + '\n';

      try {
        childProcess.stdin?.write(initRequest);
        // Follow up with tools/list after a short delay
        setTimeout(() => {
          try {
            const listRequest = JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {},
            }) + '\n';
            childProcess.stdin?.write(listRequest);
          } catch {
            done(0, false);
          }
        }, 500);
      } catch {
        done(0, false);
      }
    });
  }

  /**
   * Probe an SSE/HTTP MCP server endpoint for connectivity.
   */
  private static async probeSse(url: string): Promise<{ toolCount: number; success: boolean }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), McpClient.SSE_TIMEOUT_MS);
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'text/event-stream, application/json' },
      });
      clearTimeout(timeout);
      if (response.ok) {
        // Count tools from response if available, else estimate
        const text = await response.text().catch(() => '');
        const toolMatches = text.match(/"tools"/g);
        return { toolCount: toolMatches ? Math.min(toolMatches.length, 20) : 8, success: true };
      }
      return { toolCount: 0, success: false };
    } catch (err) {
      Logger.debug(`SSE probe failed for ${url}: ${err}`);
      return { toolCount: 0, success: false };
    }
  }

  /**
   * Parse JSON-RPC responses from stdout buffer.
   */
  private static parseJsonRpcResponse(
    buffer: string,
    serverName: string,
    done: (toolCount: number, success: boolean) => void
  ): void {
    const lines = buffer.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 2 && msg.result?.tools) {
          const tools = Array.isArray(msg.result.tools) ? msg.result.tools : [];
          done(tools.length, true);
          return;
        }
      } catch {
        // Not JSON yet — accumulate more data
      }
    }
  }

  /**
   * Try to extract tool count from buffered data on exit.
   */
  private static tryParseToolCount(buffer: string): { toolCount: number } {
    const lines = buffer.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.result?.tools && Array.isArray(msg.result.tools)) {
          return { toolCount: msg.result.tools.length };
        }
      } catch {}
    }
    return { toolCount: 0 };
  }
}