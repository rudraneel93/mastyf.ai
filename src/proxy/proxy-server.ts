import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { TokenCounter } from '../utils/token-counter.js';
import { ProxyCallRecord } from '../types.js';
import { HistoryDatabase } from '../database/history-db.js';
import { Logger } from '../utils/logger.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { CallContext } from '../policy/policy-types.js';
import { StructuredLogger } from '../utils/structured-logger.js';

/**
 * MCP Proxy Interceptor — sits between the AI client and an MCP server,
 * capturing every JSON-RPC call's token usage for real cost auditing.
 *
 * v0.4: Integrated PolicyEngine for active blocking of malicious tool calls.
 * If policyEngine is provided, every tools/call is evaluated before forwarding.
 * Blocked calls return a JSON-RPC error to the client instead of reaching the server.
 */
export class McpProxyServer {
  private child: ChildProcess;
  private tokenCounter: TokenCounter;
  private db: HistoryDatabase;
  private currentRequestId: string | null = null;
  private requestStartTime: number = 0;
  private requestToolName: string | null = null;
  private requestTokens: number = 0;
  private requestArguments: Record<string, unknown> | undefined;
  private serverName: string;
  private policyEngine: PolicyEngine | null;

  constructor(
    command: string,
    args: string[],
    env: Record<string, string>,
    db: HistoryDatabase,
    serverName?: string,
    policyEngine?: PolicyEngine,
  ) {
    this.serverName = serverName || command.split('/').pop() || command;
    this.policyEngine = policyEngine || null;
    this.child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.tokenCounter = new TokenCounter();
    this.db = db;
    this.setupStdout();
    this.setupStderr();

    StructuredLogger.info({
      event: 'proxy_started',
      serverName: this.serverName,
      blockingMode: this.policyEngine ? this.policyEngine.getMode() : 'audit',
    });
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
          this.db.addCallRecord(record).then(() => this.db.flush()).catch((err) =>
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
   * Evaluates tools/call against policy engine before forwarding.
   * Blocked calls receive a JSON-RPC error response.
   */
  handleClientInput(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'tools/call' && msg.id) {
        this.requestStartTime = Date.now();
        this.currentRequestId = msg.id;
        this.requestToolName = msg.params?.name || 'unknown';
        this.requestTokens = this.tokenCounter.count(raw);
        this.requestArguments = msg.params?.arguments;

        // ── v0.4: Active policy enforcement ──────────────────
        if (this.policyEngine) {
          const toolName = this.requestToolName || 'unknown';
          const context: CallContext = {
            serverName: this.serverName,
            toolName,
            arguments: this.requestArguments,
            requestId: msg.id as string | number,
            requestTokens: this.requestTokens,
            timestamp: new Date().toISOString(),
          };

          const decision = this.policyEngine.evaluate(context);

          // Log every decision for SIEM audit trail
          StructuredLogger.logPolicyDecision({
            event: 'policy_decision',
            requestId: msg.id as string | number,
            serverName: this.serverName,
            toolName,
            decision,
            context,
          });

          if (decision.action === 'block') {
            StructuredLogger.logBlocked({
              event: 'tool_blocked',
              requestId: msg.id as string | number,
              serverName: this.serverName,
              toolName,
              reason: decision.reason,
              rule: decision.rule,
            });

            // Return JSON-RPC 2.0 error to client — do NOT forward to server
            const errorResponse = JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              error: {
                code: -32001,
                message: `Blocked by MCP Guardian policy: ${decision.reason}`,
                data: { rule: decision.rule, policy: this.policyEngine.getMode() },
              },
            });
            process.stdout.write(errorResponse + '\n');

            // Reset state
            this.currentRequestId = null;
            this.requestToolName = null;
            this.requestArguments = undefined;
            return; // ← CRITICAL: do not forward to child
          }
        }
      }
    } catch {
      // Non-JSON input — forward as-is
    }
    // Forward to the underlying MCP server
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