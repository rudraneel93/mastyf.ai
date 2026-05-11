/**
 * HTTP/SSE Transparent Proxy for Cost Auditing.
 *
 * Intercepts HTTP requests to upstream MCP servers, inspects JSON-RPC tools/call
 * payloads, runs token counting and policy evaluation, then forwards to the target.
 * This closes the single biggest production gap — the original proxy only handled
 * stdio-based MCP servers.
 */
import httpProxy from 'http-proxy';
import { IncomingMessage, ServerResponse, Server } from 'http';

// Import existing core modules for token counting, policy, and DB
// These will be injected at runtime to avoid circular dependencies

interface TokenCounterLike {
  count(text: string): number;
  countWithProvider(text: string, model?: string): { tokens: number; provider: string; isEstimate: boolean };
}

interface PolicyEngineLike {
  evaluate(context: any): { action: string; rule: string; reason: string };
  getMode(): string;
}

interface DatabaseLike {
  addCallRecord(record: any): Promise<void>;
}

export function createHttpProxy(
  target: string,
  policyEngine: PolicyEngineLike | null,
  db: DatabaseLike,
  tokenCounter: TokenCounterLike,
  dbLogFn?: (entry: Record<string, unknown>) => void,
): Server {
  const proxy = httpProxy.createProxyServer({
    target,
    changeOrigin: true,
    ws: false,
    proxyTimeout: 30000,
    timeout: 30000,
  });

  const server = new Server(async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = Math.random().toString(36).slice(2);
    const start = Date.now();

    // ── Only intercept POST requests (JSON-RPC calls) ──
    if (req.method !== 'POST') {
      proxy.web(req, res, { target });
      return;
    }

    // ── Buffer the body for inspection ──────────────────
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      const rawBody = Buffer.concat(chunks);
      let parsed: any;
      try {
        parsed = JSON.parse(rawBody.toString());
      } catch {
        // Not JSON — forward normally
        proxy.web(req, res, { target, buffer: rawBody });
        return;
      }

      // ── Check if it's a tools/call JSON-RPC ──────────────
      if (parsed.method === 'tools/call') {
        const toolName = parsed.params?.name || 'unknown';
        const args = parsed.params?.arguments || {};

        // ── Policy evaluation ─────────────────────────────
        if (policyEngine) {
          const policyResult = policyEngine.evaluate({
            toolName,
            arguments: args,
            transport: 'http',
            serverName: target,
            requestId,
            requestTokens: tokenCounter.count(rawBody.toString()),
            timestamp: new Date().toISOString(),
          });

          if (policyResult.action === 'block') {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              error: {
                code: -32000,
                message: `Blocked by MCP Guardian policy: ${policyResult.reason}`,
                data: { rule: policyResult.rule },
              },
            }));

            // Log blocked call to DB
            if (dbLogFn) {
              dbLogFn({
                requestId, toolName, target,
                blocked: true, reason: policyResult.reason,
                inputTokens: tokenCounter.count(rawBody.toString()),
                durationMs: Date.now() - start,
              });
            }
            return;
          }
        }

        // ── Count input tokens ────────────────────────────
        const inputTokens = tokenCounter.count(rawBody.toString());

        // ── Forward request, capture response ─────────────
        const proxyReq = proxy.web(req, res, {
          target,
          selfHandleResponse: true,
          buffer: rawBody,
        });

        const responseChunks: Buffer[] = [];
        proxyReq.on('proxyRes', (proxyRes) => {
          proxyRes.on('data', (chunk: Buffer) => responseChunks.push(chunk));
          proxyRes.on('end', async () => {
            const responseBody = Buffer.concat(responseChunks).toString();
            let outputTokens = 0;

            try {
              const responseJson = JSON.parse(responseBody);
              if (responseJson.result?.content) {
                const text = (responseJson.result.content as Array<{ text?: string }>)
                  .map(c => c.text || '')
                  .join('');
                outputTokens = tokenCounter.count(text);
              }
            } catch {
              // Non-JSON response — use character estimate
              outputTokens = Math.round(responseBody.length * 0.25);
            }

            const totalTokens = inputTokens + outputTokens;
            const durationMs = Date.now() - start;

            // ── Log to database ───────────────────────────
            try {
              await db.addCallRecord({
                requestId,
                serverName: target,
                toolName,
                requestTokens: inputTokens,
                responseTokens: outputTokens,
                totalTokens,
                durationMs,
                timestamp: new Date().toISOString(),
              });
            } catch (err: any) {
              console.error(`[http-proxy] DB log error: ${err?.message}`);
            }

            if (dbLogFn) {
              dbLogFn({
                requestId, toolName, target,
                inputTokens, outputTokens, totalTokens,
                durationMs, blocked: false,
              });
            }
          });
        });

        proxyReq.on('error', (err) => {
          console.error(`[http-proxy] Proxy error: ${err.message}`);
          if (!res.headersSent) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: `Upstream error: ${err.message}` }));
          }
        });
      } else {
        // Not a tools/call: proxy normally
        proxy.web(req, res, { target, buffer: rawBody });
      }
    });
  });

  return server;
}