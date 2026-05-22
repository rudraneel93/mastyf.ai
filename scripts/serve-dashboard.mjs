#!/usr/bin/env node
/**
 * Standalone dashboard HTTP server (port 4000 by default).
 * Use after pnpm dashboard:build when you only need the SPA + API shell.
 */
import { startDashboardServer } from '../dist/utils/dashboard-server.js';

const port = parseInt(process.env.DASHBOARD_PORT || '4000', 10);
process.env.DASHBOARD_ENABLED = 'true';
process.env.GUARDIAN_WS_ENABLED = process.env.GUARDIAN_WS_ENABLED ?? 'true';

await startDashboardServer(port);
console.log(`[serve-dashboard] http://localhost:${port}/ (Ctrl+C to stop)`);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
