/**
 * Shared HTTP/SSE (and WebSocket) gateway mode — no stdio child processes.
 */
import { Logger } from '../utils/logger.js';
import { isMultiTenantModeEnabled } from './resolve-tenant.js';

export function isGatewayModeEnabled(): boolean {
  return (
    process.env['GUARDIAN_GATEWAY_MODE'] === 'true'
    || process.argv.includes('--gateway')
  );
}

/** Fail fast when gateway mode is misconfigured. */
export function assertGatewayStartup(): void {
  if (!isMultiTenantModeEnabled()) {
    Logger.error(
      '[gateway] GUARDIAN_GATEWAY_MODE requires GUARDIAN_MULTI_TENANT_ENABLED=true',
    );
    throw new Error('Gateway mode requires multi-tenant enabled');
  }
  Logger.info(
    '[gateway] Shared ingress mode — SSE/WebSocket only (no stdio MCP children)',
  );
}
