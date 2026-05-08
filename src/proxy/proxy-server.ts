import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { TokenCounter } from '../utils/token-counter.js';
import { ProxyCallRecord } from '../types.js';
import { HistoryDatabase } from '../database/history-db.js';
import { Logger } from '../utils/logger.js';

/**
 * MCP Proxy Interceptor — sits between the AI client and an MCP server,
 * capturing every JSON-RPC call's token usage for real cost auditing.
 */
export class McpProxyServer {
  private child: ChildProcess;
  private tokenCounter: TokenCounter;
  private db: HistoryDatabase;
  private currentRequestId: string | null = null;
  private requestStartTime: number = 0;
  private requestToolName: string | null = null;
  private requestTokens: number = 0;
  private serverName: string;

  constructor(
    command: string,
    args: string[],
    env: Record<string, string>,
    db: HistoryDatabase,
    serverName?: string
  ) {
    this.serverName = serverName || command.split('/').pop() || command;
    this.child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.tokenCounter = new TokenCounter();
    this.db = db;
    this.setupStdout();
    this.setupStderr();
  }

  get stdin(): NodeJS.WritableStream | null {
    return this.child.stdin;
  }

  private setupStdout(): void {
    const rl = createInterface({ input: this.child.stdout! });
    rl.on('line', (line: string) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id && msg.id === this.currentRequestId) {
          // Response to our tracked tools/call request
          const responseTokens = this.tokenCounter.count(line);
          const record: ProxyCallRecord = {
            serverName: this.serverName,
            toolName: this.requestToolName || 'unknown',
            requestTokens: this.requestTokens,
            responseTokens,
            totalTokens: this.requestTokens + responseTokens,
            durationMs: Date.now() - this.requestStartTime,
            timestamp: new Date().toISOString(),
          };
          this.db.addCallRecord(record).catch((err) =>
            Logger.debug(`Proxy: failed to store call record: ${err?.message}`)
          );
          this.currentRequestId = null;
          this.requestToolName = null;
        }
        // Forward response to client
        process.stdout.write(line + '\n');
      } catch {
        // Non-JSON line — forward as-is
        process.stdout.write(line + '\n');
      }
    });

    rl.on('close', () => {
      Logger.debug(`[proxy:${this.serverName}] stdout closed`);
    });
  }

  private setupStderr(): void {
    this.child.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });
  }

  /**
   * Called when the AI client writes a request to be proxied.
   * Tracks tools/call requests for token counting.
   */
  handleClientInput(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'tools/call' && msg.id) {
        this.requestStartTime = Date.now();
        this.currentRequestId = msg.id;
        this.requestToolName = msg.params?.name || 'unknown';
        this.requestTokens = this.tokenCounter.count(raw);
      }
    } catch {
      // Non-JSON input — forward as-is
    }
    this.child.stdin?.write(raw + '\n');
  }

  kill(): void {
    try {
      this.child.kill();
    } catch {
      // Already dead
    }
  }
}