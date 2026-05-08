#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigParser } from './config-parser.js';
import { HistoryDatabase } from './database/history-db.js';
import { ReportGenerator } from './reporter/report-generator.js';
import { FullReport, SecurityReport, McpServerConfig } from './types.js';
import { calculateOverallScore } from './utils/scoring.js';
import { ProxyManager } from './proxy/proxy-manager.js';
import { createContainer } from './container.js';

// ── Typed option interfaces ──────────────────────────────────────────
interface ScanOptions {
  config?: string;
  all?: boolean;
  thresholdScore?: number;
  failOnCritical?: boolean;
  failOnSecrets?: boolean;
}

interface AuditOptions {
  config?: string;
  all?: boolean;
  server?: string;
  thresholdCost?: number;
}

interface HealthOptions {
  config?: string;
  all?: boolean;
  server?: string;
  thresholdLatency?: number;
  failOnOverload?: boolean;
}

interface ReportOptions {
  config?: string;
  all?: boolean;
  format?: 'json' | 'markdown' | 'text';
  thresholdScore?: number;
}

interface ProxyOptions {
  config?: string;
}

// ── Shared helpers ────────────────────────────────────────────────────
function loadConfigs(options: { all?: boolean; config?: string }): {
  servers: McpServerConfig[];
  sourcePaths: string[];
} {
  if (options.all) {
    return ConfigParser.parseAll();
  }
  const paths = options.config ? [options.config] : ConfigParser.findConfigPaths();
  if (paths.length === 0) return { servers: [], sourcePaths: [] };
  return { servers: ConfigParser.parse(paths[0]), sourcePaths: [paths[0]] };
}

function checkAlertThresholds(reports: SecurityReport[], opts: ScanOptions | ReportOptions): void {
  if ('failOnCritical' in opts && opts.failOnCritical && reports.some((r) => r.cves.some((c) => c.severity === 'CRITICAL'))) {
    console.error(chalk.red('\n⚠ Critical CVE(s) detected'));
    process.exit(1);
  }
  if ('failOnSecrets' in opts && opts.failOnSecrets && reports.some((r) => r.secretsFound.length > 0)) {
    console.error(chalk.red('\n⚠ Hardcoded secrets detected'));
    process.exit(1);
  }
  if (opts.thresholdScore !== undefined) {
    const below = reports.filter((r) => r.score < opts.thresholdScore!);
    if (below.length > 0) {
      console.error(chalk.red(`\n⚠ ${below.length} server(s) below score threshold ${opts.thresholdScore}: ${below.map((r) => `${r.serverName} (${r.score})`).join(', ')}`));
      process.exit(2);
    }
  }
}

// ── CLI commands ──────────────────────────────────────────────────────
const program = new Command();
program
  .name('mcp-doctor')
  .description('Security, cost, and health audit for MCP infrastructure')
  .version('0.3.0');

program
  .command('scan')
  .description('Run security scan on MCP servers')
  .option('-c, --config <path>', 'Path to an MCP config file')
  .option('-a, --all', 'Aggregate all discoverable config files')
  .option('--threshold-score <number>', 'Exit code 2 if any server score drops below threshold', parseInt)
  .option('--fail-on-critical', 'Exit code 1 if any critical CVE found')
  .option('--fail-on-secrets', 'Exit code 1 if any hardcoded secrets detected')
  .action(async (opts: ScanOptions) => {
    const { servers, sourcePaths } = loadConfigs(opts);
    if (servers.length === 0) { console.error(chalk.yellow('No servers found in config.')); process.exit(0); }

    if (opts.all && sourcePaths.length > 1) {
      console.error(chalk.dim(`Aggregated ${sourcePaths.length} configs: ${sourcePaths.join(', ')}`));
    } else {
      console.error(chalk.dim(`Using config: ${sourcePaths[0] || 'auto-detected'}`));
    }

    const container = createContainer();
    const reports = await Promise.all(servers.map((s) => container.securityScanner.scanServer(s)));
    await Promise.all(reports.map((r) => container.db.addSecurityScan(r.serverName, r.score, r.cves.length, r)));
    container.db.close();

    console.log(new ReportGenerator().formatSecurityReports(reports));
    checkAlertThresholds(reports, opts);
  });

program
  .command('audit')
  .description('Audit token costs for MCP servers')
  .option('-c, --config <path>', 'Path to an MCP config file')
  .option('-a, --all', 'Aggregate all discoverable config files')
  .option('-s, --server <name>', 'Filter to a specific server')
  .option('--threshold-cost <number>', 'Exit code 2 if total cost exceeds threshold (USD)', parseFloat)
  .action(async (opts: AuditOptions) => {
    const { servers } = loadConfigs(opts);
    const filtered = opts.server ? servers.filter((s) => s.name === opts.server) : servers;
    if (filtered.length === 0) { console.error(chalk.yellow('No servers found.')); process.exit(0); }

    const container = createContainer();
    const results = await Promise.all(filtered.map((s) => container.costAuditor.auditServer(s)));
    container.costAuditor.dispose();
    await Promise.all(results.map((r) => container.db.addCostRecord(r.serverName, r.tokensUsed, r.estimatedCostUSD)));
    container.db.close();

    console.log(new ReportGenerator().formatCostReports(results));

    if (opts.thresholdCost) {
      const total = results.reduce((s, r) => s + r.estimatedCostUSD, 0);
      if (total > opts.thresholdCost) {
        console.error(chalk.red(`\n⚠ Total cost $${total.toFixed(4)} exceeds threshold $${opts.thresholdCost.toFixed(4)}`));
        process.exit(2);
      }
    }
  });

program
  .command('health')
  .description('Check health of MCP servers')
  .option('-c, --config <path>', 'Path to an MCP config file')
  .option('-a, --all', 'Aggregate all discoverable config files')
  .option('-s, --server <name>', 'Filter to a specific server')
  .option('--threshold-latency <ms>', 'Exit code 2 if any server exceeds latency threshold', parseInt)
  .option('--fail-on-overload', 'Exit code 1 if any server has tool overload')
  .action(async (opts: HealthOptions) => {
    const { servers } = loadConfigs(opts);
    const filtered = opts.server ? servers.filter((s) => s.name === opts.server) : servers;
    if (filtered.length === 0) { console.error(chalk.yellow('No servers found.')); process.exit(0); }

    const container = createContainer();
    const results = await Promise.all(filtered.map((s) => container.healthMonitor.checkServer(s)));
    await Promise.all(results.map((r) => container.db.addHealthCheck(r.serverName, r.latencyMs, r.successRate > 0.5, r.toolCount)));
    container.db.close();

    console.log(new ReportGenerator().formatHealthReports(results));

    if (opts.failOnOverload && results.some((r) => r.overloadWarning)) {
      console.error(chalk.red('\n⚠ One or more servers have tool overload'));
      process.exit(1);
    }
    if (opts.thresholdLatency !== undefined) {
      const slow = results.filter((r) => r.latencyMs > opts.thresholdLatency!);
      if (slow.length > 0) {
        console.error(chalk.red(`\n⚠ ${slow.length} server(s) exceed ${opts.thresholdLatency}ms latency: ${slow.map((r) => r.serverName).join(', ')}`));
        process.exit(2);
      }
    }
  });

program
  .command('report')
  .description('Generate a full MCP Doctor report')
  .option('-c, --config <path>', 'Path to an MCP config file')
  .option('-a, --all', 'Aggregate all discoverable config files')
  .option('-f, --format <format>', 'Output format: text (default), markdown, or json', 'text')
  .option('--threshold-score <number>', 'Exit code 2 if overall score drops below threshold', parseInt)
  .action(async (opts: ReportOptions) => {
    const { servers, sourcePaths } = loadConfigs(opts);
    if (servers.length === 0) { console.error(chalk.yellow('No servers found in config.')); process.exit(0); }

    if (opts.all && sourcePaths.length > 1) {
      console.error(chalk.dim(`Aggregated ${sourcePaths.length} configs: ${sourcePaths.join(', ')}`));
    } else {
      console.error(chalk.dim(`Using config: ${sourcePaths[0] || 'auto-detected'}`));
    }

    const container = createContainer();
    const [security, costs, health] = await Promise.all([
      Promise.all(servers.map((s) => container.securityScanner.scanServer(s))),
      Promise.all(servers.map((s) => container.costAuditor.auditServer(s))),
      Promise.all(servers.map((s) => container.healthMonitor.checkServer(s))),
    ]);
    container.costAuditor.dispose();
    await Promise.all([
      ...security.map((r) => container.db.addSecurityScan(r.serverName, r.score, r.cves.length, r)),
      ...costs.map((r) => container.db.addCostRecord(r.serverName, r.tokensUsed, r.estimatedCostUSD)),
      ...health.map((r) => container.db.addHealthCheck(r.serverName, r.latencyMs, r.successRate > 0.5, r.toolCount)),
    ]);
    container.db.close();

    const overallScore = calculateOverallScore(security, health);
    const configPath = opts.all ? `aggregated (${sourcePaths.length} files)` : (sourcePaths[0] || 'auto-detected');
    const fullReport: FullReport = { timestamp: new Date().toISOString(), configPath, security, costs, health, overallScore };
    const reporter = new ReportGenerator();

    if (opts.format === 'json') console.log(JSON.stringify(fullReport, null, 2));
    else if (opts.format === 'markdown') console.log(reporter.toMarkdown(fullReport));
    else console.log(reporter.formatFullReport(fullReport));

    checkAlertThresholds(security, opts);
  });

program
  .command('proxy')
  .description('Start MCP Doctor proxy to capture real token usage data')
  .option('-c, --config <path>', 'Path to MCP config file')
  .action(async (opts: ProxyOptions) => {
    const paths = opts.config ? [opts.config] : ConfigParser.findConfigPaths();
    if (paths.length === 0) { console.error(chalk.red('No MCP config files found. Use --config to specify a path.')); process.exit(1); }

    const servers = ConfigParser.parse(paths[0]);
    if (servers.length === 0) { console.error(chalk.yellow('No servers found in config.')); process.exit(0); }

    const db = new HistoryDatabase();
    const manager = new ProxyManager(db);
    await manager.startAll(servers);

    console.error(chalk.green('MCP Doctor proxy running. Press Ctrl+C to stop.'));
    const cleanup = () => { manager.stopAll(); db.close(); process.exit(0); };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    const proxies = manager.getProxies();
    if (proxies.length > 0) {
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', (chunk: string) => {
        for (const proxy of proxies) proxy.handleClientInput(chunk.trim());
      });
    }
  });

program.parse();