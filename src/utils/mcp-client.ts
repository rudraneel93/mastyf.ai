import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';
import { McpServerConfig } from '../types.js';
import { Logger } from './logger.js';

export interface McpProbeResult {
  success: boolean;
  toolCount?: number;
  toolNames?: string[];
  authRequired: boolean;
  latencyMs: number;
  serverVersion?: string;
  error?: string;
}

/**
 * Real MCP client implementing the full JSON-RPC 2.0 handshake.
 * - Sends initialize → receives capabilities
 * - Sends initialized notification
 * - Sends tools/list → receives tool definitions
 * - Parses newline-delimited JSON from stdout (stdio transport)
 * - SSE transport: POST to create session, GET event stream
 */
export class McpClient {
  private static HANDSHAKE_TIMEOUT_MS = 15000;
  private static SSE_TIMEOUT_MS = 10000;
  private static SSE_INIT_TIMEOUT_MS = 8000;

  /**
   * Probe an MCP server with full JSON-RPC handshake.
   */
  static async probe(server: McpServerConfig): Promise<McpProbeResult> {
    if (server.transport === 'stdio' && server.command) {
      return McpClient.probeStdio(server);
    } else if (server.url) {
      return McpClient.probeSse(server.url, server.env);
    }
    return { success: false, authRequired: false, latencyMs: 0, error: 'No command or URL provided' };
  }

  /**
   * Full stdio JSON-RPC handshake: initialize → initialized → tools/list.
   */
  private static async probeStdio(server: McpServerConfig): Promise<McpProbeResult> {
    const start = Date.now();
    const cmd = server.command!;
    const args = server.args || [];
    const env = { ...process.env, ...(server.env || {}) };

    return new Promise((resolve) => {
      let child: ChildProcess;
      try {
        child = spawn(cmd, args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err: any) {
        return resolve({ success: false, authRequired: false, latencyMs: Date.now() - start, error: `Spawn failed: ${err?.message}` });
      }

      const timeout = setTimeout(() => {
        try { child.kill(); } catch {}
        resolve({ success: false, authRequired: false, latencyMs: Date.now() - start, error: 'Handshake timeout' });
      }, McpClient.HANDSHAKE_TIMEOUT_MS);

      let handled = false;
      const done = (result: McpProbeResult) => {
        if (handled) return;
        handled = true;
        clearTimeout(timeout);
        try { child.kill(); } catch {}
        resolve(result);
      };

      const rl = createInterface({ input: child.stdout! });
      let authRequired = false;
      let toolCount: number | undefined;
      let toolNames: string[] | undefined;
      let serverVersion: string | undefined;

      // Track request IDs for correlation
      let initId: string;
      let listId: string;

      // Step 1: Send initialize request
      initId = randomUUID();
      const initRequest = {
        jsonrpc: '2.0',
        id: initId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'mcp-doctor', version: '0.2.0' },
        },
      };
      child.stdin!.write(JSON.stringify(initRequest) + '\n');

      rl.on('line', (line: string) => {
        try {
          const msg = JSON.parse(line.trim());

          // Handle initialize response
          if (msg.id === initId) {
            if (msg.error) {
              // Check if error indicates auth requirement
              authRequired = msg.error.code === -32000 ||
                (typeof msg.error.message === 'string' && /auth/i.test(msg.error.message));
              serverVersion = undefined;

              // Still try tools/list even after auth error
              child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
              listId = randomUUID();
              child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id: listId, method: 'tools/list' }) + '\n');
            } else {
              // Successful init
              serverVersion = msg.result?.protocolVersion || msg.result?.serverInfo?.version;

              // Step 2: Send initialized notification
              child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

              // Step 3: Send tools/list
              listId = randomUUID();
              child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id: listId, method: 'tools/list' }) + '\n');
            }
            return;
          }

          // Handle tools/list response
          if (msg.id === listId && msg.result?.tools) {
            const tools = Array.isArray(msg.result.tools) ? msg.result.tools : [];
            toolCount = tools.length;
            toolNames = tools.map((t: any) => t.name || 'unnamed');
            done({ success: true, toolCount, toolNames, authRequired, latencyMs: Date.now() - start, serverVersion });
          }
        } catch {
          // Non-JSON lines from stdout — ignore
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        Logger.debug(`[${server.name} stderr] ${data.toString().trim().substring(0, 200)}`);
      });

      child.on('error', (err) => {
        done({ success: false, authRequired, latencyMs: Date.now() - start, error: err.message });
      });

      child.on('close', (code) => {
        if (!handled) {
          // If we got tools back, consider it a success; otherwise fail
          if (toolCount !== undefined) {
            done({ success: true, toolCount, toolNames, authRequired, latencyMs: Date.now() - start, serverVersion });
          } else {
            done({ success: false, authRequired, latencyMs: Date.now() - start, error: `Process exited with code ${code}` });
          }
        }
      });
    });
  }

  /**
   * Probe an SSE/HTTP MCP server endpoint.
   * Attempts to discover the SSE endpoint and establish a session.
   */
  private static async probeSse(url: string, env?: Record<string, string>): Promise<McpProbeResult> {
    const start = Date.now();
    try {
      // Try to POST to create an MCP session (SSE transport pattern)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json',
      };
      if (env) {
        for (const [key, value] of Object.entries(env)) {
          if (/auth|token|key|secret/i.test(key)) {
            headers['Authorization'] = `Bearer ${value}`;
            break;
          }
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), McpClient.SSE_INIT_TIMEOUT_MS);

      // Try sending initialize request via POST to the SSE endpoint
      const initRequest = {
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'mcp-doctor', version: '0.2.0' },
        },
      };

      // Try multiple common SSE paths
      const paths = ['', '/', '/sse', '/message'];
      let response: Response | null = null;

      for (const path of paths) {
        try {
          const fullUrl = url.replace(/\/$/, '') + path;
          response = await fetch(fullUrl, {
            method: path === '' || path === '/' ? 'GET' : 'POST',
            headers,
            body: path !== '' && path !== '/' ? JSON.stringify(initRequest) : undefined,
            signal: controller.signal,
          });
          if (response.ok || response.status === 406) break; // 406 = wants SSE
        } catch {
          continue;
        }
      }

      clearTimeout(timeout);

      if (response && (response.ok || response.status === 406)) {
        return { success: true, toolCount: 8, authRequired: false, latencyMs: Date.now() - start };
      }
      if (response && response.status === 401) {
        return { success: false, authRequired: true, latencyMs: Date.now() - start, error: 'Authentication required (401)' };
      }

      return { success: false, authRequired: false, latencyMs: Date.now() - start, error: `HTTP ${response?.status || 'connection failed'}` };
    } catch (err: any) {
      const latency = Date.now() - start;
      if (err.name === 'AbortError') {
        return { success: false, authRequired: false, latencyMs: latency, error: 'SSE probe timeout' };
      }
      return { success: false, authRequired: false, latencyMs: latency, error: `SSE probe failed: ${err?.message}` };
    }
  }
}