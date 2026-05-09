/**
 * Policy types for the MCP Guardian active blocking engine.
 */

export type PolicyAction = 'pass' | 'block' | 'flag';

export type PolicyMode = 'audit' | 'warn' | 'block';

export interface PolicyRule {
  name: string;
  description?: string;
  action: PolicyAction;
  /** Tool name allowlist — if specified, only these tools are permitted */
  tools?: {
    allow?: string[];
    deny?: string[];
  };
  /** Regex patterns for blocking malicious tool arguments */
  patterns?: string[];
  /** Max tokens per call */
  maxTokens?: number;
  /** Max calls per minute per server */
  maxCallsPerMinute?: number;
  /** v0.5.1: RBAC — scope and client_id constraints */
  rbac?: {
    /** Required scopes the agent must have */
    scopes?: string[];
    /** Allowed client IDs (regex patterns supported) */
    clientIds?: string[];
  };
}

export interface PolicyConfig {
  version: string;
  policy: {
    mode: PolicyMode;
    rules: PolicyRule[];
  };
}

export interface PolicyDecision {
  action: PolicyAction;
  rule: string;
  reason: string;
}

export interface CallContext {
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  requestId: string | number;
  requestTokens: number;
  timestamp: string;
  /** v0.5.1: Agent identity from OAuth (for RBAC) */
  agentIdentity?: import('../auth/auth-types.js').AgentIdentity;
}
