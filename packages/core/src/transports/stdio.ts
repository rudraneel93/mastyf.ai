import { spawn } from "node:child_process";
import type { ToolDefinition } from "../types.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface StdioServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

export async function fetchToolsFromStdio(
  config: StdioServerConfig
): Promise<ToolDefinition[]> {
  const timeoutMs = config.timeoutMs ?? 15_000;

  return new Promise((resolve, reject) => {
    const child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`Stdio server timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", () => { /* discard stderr */ });

    child.on("error", (err) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    });

    // Wait for server to be ready, then send initialize + tools/list
    child.on("spawn", async () => {
      try {
        const send = (req: JsonRpcRequest) => {
          const line = JSON.stringify(req) + "\n";
          child.stdin.write(line);
        };

        // MCP handshake
        send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-guardian", version: "2.0.0" },
        }});

        // Give server 2s to initialize
        await new Promise(r => setTimeout(r, 2000));

        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

        // Wait for response
        await new Promise(r => setTimeout(r, 3000));

        child.kill();

        if (!settled) {
          settled = true;
          clearTimeout(timer);

          // Parse NDJSON from stdout
          const lines = stdout.split("\n").filter(Boolean);
          const tools: ToolDefinition[] = [];

          for (const line of lines) {
            try {
              const msg: JsonRpcResponse = JSON.parse(line);
              if (msg.id === 2 && msg.result) {
                const result = msg.result as { tools?: ToolDefinition[] };
                tools.push(...(result.tools ?? []));
              }
            } catch {
              // Skip non-JSON lines (startup messages, etc.)
            }
          }

          resolve(tools);
        }
      } catch (err) {
        if (!settled) { settled = true; clearTimeout(timer); reject(err); }
      }
    });
  });
}