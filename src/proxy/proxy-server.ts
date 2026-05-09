import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { TokenCounter } from '../utils/token-counter.js';
import { ProxyCallRecord } from '../types.js';
import { HistoryDatabase } from '../database/history-db.js';
import { Logger } from '../utils/logger.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { CallContext } from '../policy/policy-types.js';
import { StructuredLogger } from '../utils/structured-logger.js';
import { OAuthValidator } from '../auth/oauth.js';
import { AuthValidationResult } from '../auth/auth-types.js';

/**
 * MCP Proxy Interceptor — sits between the AI client and an MCP server.
 *
 * v0.4: Integrated PolicyEngine for active blocking of malicious tool calls.
 * v0.5: OAuth 2.1 JWT validation — validates bearer tokens before policy evaluation.
 *   If authValidator is provided, every tools/call requires a valid JWT.
 *   Unauthenticated calls are blocked with a JSON-RPC auth error.
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
  private authValidator: OAuthValidator | null;

  constructor(
    command: string,
    args: string[],
    env: Record<string, string>,
    db: HistoryDatabase,
    serverName?: string,
    policyEngine?: PolicyEngine,
    authValidator?: OAuthValidator,
  ) {
    this.serverName = serverName || command.split('/').pop() || command;
    this.policyEngine = policyEngine || null;
    this.authValidator = authValidator || null;
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
      authEnabled: this.authValidator ? this.authValidator.getConfig().required : false,
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
        process.stdout.write(line + '\n');
      } catch {
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
   * Send a JSON-RPC 2.0 error response to the client.
   */
  private sendError(id: string | number, code: number, message: string, data?: Record<string, unknown>): void {
    const errorResponse = JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    });
    process.stdout.write(errorResponse + '\n');
  }

  /**
   * Called when the AI client writes a request to be proxied.
   * 1. Validate OAuth 2.1 JWT (if configured)
   * 2. Evaluate against policy engine
   * 3. Forward or block
   */
  async handleClientInput(raw: string): Promise<void> {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'tools/call' && msg.id) {
        this.requestStartTime = Date.now();
        this.currentRequestId = msg.id;
        this.requestToolName = msg.params?.name || 'unknown';
        this.requestTokens = this.tokenCounter.count(raw);
        this.requestArguments = msg.params?.arguments;
        const toolName = this.requestToolName || 'unknown';

        // ── v0.5: OAuth 2.1 JWT validation ──────────────────
        if (this.authValidator) {
          const authHeader = msg.params?._meta?.auth?.Authorization
            || msg.Authorization
            || msg.params?.Authorization
            || undefined;

          const token = OAuthValidator.extractToken(authHeader);

          if (!token) {
            if (this.authValidator.getConfig().required) {
              StructuredLogger.info({
                event: 'auth_required',
                serverName: this.serverName,
                toolName,
                requestId: msg.id as string | number,
              });
              this.sendError(msg.id, -32002, 'Authentication required. Provide a valid Bearer token in the Authorization header.');
              this.currentRequestId = null;
              this.requestToolName = null;
              this.requestArguments = undefined;
              return;
            }
          } else {
            const result: AuthValidationResult = await this.authValidator.validate(token);

            if (!result.valid) {
              StructuredLogger.logError({
                event: 'oidc_auth_error',
                serverName: this.serverName,
                error: `JWT validation failed: ${result.error}`,
                requestId: msg.id as string | number,
              });

              if (this.authValidator.getConfig().required) {
                this.sendError(msg.id, -32003, `Authentication failed: ${result.error}`);
                this.currentRequestId = null;
                this.requestToolName = null;
                this.requestArguments = undefined;
                return;
              }
            } else {
              StructuredLogger.info({
                event: 'auth_success',
                serverName: this.serverName,
                toolName,
                requestId: msg.id as string | number,
                agent: result.identity?.sub,
                clientId: result.identity?.clientId,
              });
            }
          }
        }

        // ── v0.4: Active policy enforcement ──────────────────
        if (this.policyEngine) {
          const context: CallContext = {
            serverName: this.serverName,
            toolName,
            arguments: this.requestArguments,
            requestId: msg.id as string | number,
            requestTokens: this.requestTokens,
            timestamp: new Date().toISOString(),
          };

          const decision = this.policyEngine.evaluate(context);

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

            this.sendError(msg.id, -32001, `Blocked by MCP Guardian policy: ${decision.reason}`, {
              rule: decision.rule,
              policy: this.policyEngine.getMode(),
            });

            this.currentRequestId = null;
            this.requestToolName = null;
            this.requestArguments = undefined;
            return;
          }
        }
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