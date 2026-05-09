import pino from 'pino';
import { PolicyDecision, CallContext } from '../policy/policy-types.js';

/**
 * Structured JSON logger for enterprise SIEM ingestion.
 * Uses pino for high-performance structured logging with request-ID tracing.
 */
const level = process.env.LOG_LEVEL || 'info';

const logger = pino({
  level: level.toLowerCase(),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface AuditLogEntry {
  event: 'policy_decision';
  requestId: string | number;
  serverName: string;
  toolName: string;
  decision: PolicyDecision;
  context: CallContext;
}

export interface BlockLogEntry {
  event: 'tool_blocked';
  requestId: string | number;
  serverName: string;
  toolName: string;
  reason: string;
  rule: string;
}

export interface ErrorLogEntry {
  event: 'proxy_error' | 'oidc_discovery_error' | 'oidc_auth_error';
  requestId?: string | number;
  serverName: string;
  error: string;
  stack?: string;
}

export class StructuredLogger {
  /**
   * Log a policy decision (pass, flag, or block).
   */
  static logPolicyDecision(entry: AuditLogEntry): void {
    logger.info(entry);
  }

  /**
   * Log a blocked tool call — always at WARN level for SIEM alerting.
   */
  static logBlocked(entry: BlockLogEntry): void {
    logger.warn(entry);
  }

  /**
   * Log proxy internal errors.
   */
  static logError(entry: ErrorLogEntry): void {
    logger.error(entry);
  }

  /**
   * Log general proxy lifecycle events.
   */
  static info(msg: object | string): void {
    logger.info(msg);
  }

  /**
   * Debug-level log for development.
   */
  static debug(msg: object | string): void {
    logger.debug(msg);
  }
}