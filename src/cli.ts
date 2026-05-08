#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigParser } from './config-parser.js';
import { HistoryDatabase } from './database/history-db.js';
import { ReportGenerator } from './reporter/report-generator.js';
import { FullReport } from './types.js';
import { calculateOverallScore } from './utils/scoring.js';
import { ProxyManager } from './proxy/proxy-manager.js';
import { createContainer } from './container.js';

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
  .action(async (options) => {
    const { servers, sourcePaths } = loadConfigs(options);
    if (servers.length === 0) {
      console.error(chalk.yellow('No servers found in config.'));
      process.exit(0);
    }

    if (options.all && sourcePaths.length > 1) {
      console.error(chalk.dim(`Aggregated ${sourcePaths.length} configs: ${sourcePaths.join(', ')}`));
    } else {
      console.error(chalk.dim(`Using config: ${sourcePaths[0] || 'auto-detected'}`));
    }

    const container = createContainer();
    const reports = await Promise.all(servers.map((s) => container.securityScanner.scanServer(s)));

    await Promise.all(reports.map((r) => container.db.addSecurityScan(r.serverName, r.score, r.cves.length, r)));
    container.db.close();

    console.log(new ReportGenerator().formatSecurityReports(reports));
    checkAlertThresholds(reports, options);
  });

program
  .command('audit')
  .description('Audit token costs for MCP servers')
  .option('-c, --config <path>', 'Path to an MCP config file')
  .option('-a, --all', 'Aggregate all discoverable config files')
  .option('-s, --server <name>', 'Filter to a specific server')
  .option('--threshold-cost <number>', 'Exit code 2 if total cost exceeds threshold (USD)', parseFloat)
  .action(async (options) => {
    const { servers } = loadConfigs(options);
    const filtered = options.server ? servers.filter((s) => s.name === options.server) : servers;
    if (filtered.length === 0) {
      console.error(chalk.yellow('No servers found.'));
      process.exit(0);
    }

    const container = createContainer();
    const results = await Promise.all(filtered.map((s) => container.costAuditor.auditServer(s)));
    container.costAuditor.dispose();

    await Promise.all(results.map((r) => container.db.addCostRecord(r.serverName, r.tokensUsed, r.estimatedCostUSD)));
    container.db.close();

    console.log(new ReportGenerator().formatCostReports(results));

    if (options.thresholdCost) {
      const total = results.reduce((sum, r) => sum + r.estimatedCostUSD, 0);
      if (total > options.thresholdCost) {
        console.error(chalk.red(`\n⚠ Total cost $${total.toFixed(4)} exceeds threshold $${options.thresholdCost.toFixed(4)}`));
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
  .action(async (options) => {
    const { servers } = loadConfigs(options);
    const filtered = options.server ? servers.filter((s) => s.name === options.server) : servers;
    if (filtered.length === 0) {
      console.error(chalk.yellow('No servers found.'));
      process.exit(0);
    }

    const container = createContainer();
    const results = await Promise.all(filtered.map((s) => container.healthMonitor.checkServer(s)));

    await Promise.all(results.map((r) => container.db.addHealthCheck(r.serverName, r.latencyMs, r.successRate > 0.5, r.toolCount)));
    container.db.close();

    console.log(new ReportGenerator().formatHealthReports(results));

    if (options.failOnOverload && results.some((r) => r.overloadWarning)) {
      console.error(chalk.red('\n⚠ One or more servers have tool overload'));
      process.exit(1);
    }
    if (options.thresholdLatency) {
      const slow = results.filter((r) => r.latencyMs > options.thresholdLatency);
      if (slow.length > 0) {
        console.error(chalk.red(`\n⚠ ${slow.length} server(s) exceed ${options.thresholdLatency}ms latency: ${slow.map((s) => s.serverName).join(', ')}`));
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
  .action(async (options) => {
    const { servers, sourcePaths } = loadConfigs(options);
    if (servers.length === 0) {
      console.error(chalk.yellow('No servers found in config.'));
      process.exit(0);
    }

    if (options.all && sourcePaths.length > 1) {
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
    const configPath = options.all
      ? `aggregated (${sourcePaths.length} files)`
      : sourcePaths[0] || 'auto-detected';

    const fullReport: FullReport = {
      timestamp: new Date().toISOString(),
      configPath,
      security,
      costs,
      health,
      overallScore,
    };

    const reporter = new ReportGenerator();
    const format = options.format as string;
    if (format === 'json') {
      console.log(JSON.stringify(fullReport, null, 2));
    } else if (format === 'markdown') {
      console.log(reporter.toMarkdown(fullReport));
    } else {
      console.log(reporter.formatFullReport(fullReport));
    }

    if (options.thresholdScore && overallScore < options.thresholdScore) {
      console.error(chalk.red(`\n⚠ Overall score ${overallScore}/100 is below threshold ${options.thresholdScore}`));
      process.exit(2);
    }
  });

program
  .command('proxy')
  .description('Start MCP Doctor proxy to capture real token usage data')
  .option('-c, --config <path>', 'Path to MCP config file')
  .action(async (options) => {
    const paths = options.config ? [options.config] : ConfigParser.findConfigPaths();
    if (paths.length === 0) {
      console.error(chalk.red('No MCP config files found. Use --config to specify a path.'));
      process.exit(1);
    }
    const servers = ConfigParser.parse(paths[0]);
    if (servers.length === 0) {
      console.error(chalk.yellow('No servers found in config.'));
      process.exit(0);
    }

    const db = new HistoryDatabase();
    const manager = new ProxyManager(db);
    await manager.startAll(servers);
    console.error(chalk.green('MCP Doctor proxy running. Press Ctrl+C to stop.'));
    process.on('SIGINT', () => { manager.stopAll(); db.close(); process.exit(0); });
    process.on('SIGTERM', () => { manager.stopAll(); db.close(); process.exit(0); });

    const proxies = manager.getProxies();
    if (proxies.length > 0) {
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', (chunk: string) => {
        for (const proxy of proxies) {
          proxy.handleClientInput(chunk.trim());
        }
      });
    }
  });

function loadConfigs(options: Record<string, unknown>): { servers: import('./types.js').McpServerConfig[]; sourcePaths: string[] } {
  if (options.all) {
    const result = ConfigParser.parseAll();
    return result;
  }
  const configPath = options.config as string | undefined;
  const paths = configPath ? [configPath] : ConfigParser.findConfigPaths();
  if (paths.length === 0) return { servers: [], sourcePaths: [] };
  return { servers: ConfigParser.parse(paths[0]), sourcePaths: [paths[0]] };
}

function checkAlertThresholds(
  reports: import('./types.js').SecurityReport[],
  options: Record<string, unknown>
): void {
  if (options.failOnCritical && reports.some((r) => r.cves.some((c) => c.severity === 'CRITICAL'))) {
    console.error(chalk.red('\n⚠ Critical CVE(s) detected'));
    process.exit(1);
  }
  if (options.failOnSecrets && reports.some((r) => r.secretsFound.length > 0)) {
    console.error(chalk.red('\n⚠ Hardcoded secrets detected'));
    process.exit(1);
  }
  if (options.thresholdScore) {
    const threshold = options.thresholdScore as number;
    const belowThreshold = reports.filter((r) => r.score < threshold);
    if (belowThreshold.length > 0) {
      console.error(chalk.red(`\n⚠ ${belowThreshold.length} server(s) below score threshold ${threshold}: ${belowThreshold.map((r) => `${r.serverName} (${r.score})`).join(', ')}`));
      process.exit(2);
    }
  }
}

program.parse();