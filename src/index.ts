#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigParser } from './config-parser.js';
import { ReportGenerator } from './reporter/report-generator.js';
import { FullReport, McpServerConfig } from './types.js';
import { calculateOverallScore } from './utils/scoring.js';
import { Logger } from './utils/logger.js';
import { createContainer } from './container.js';

const container = createContainer();
const reporter = new ReportGenerator();

const server = new Server(
  { name: 'mcp-doctor', version: '0.3.0' },
  { capabilities: { tools: {} } }
);

// ── Graceful shutdown ──────────────────────────────────────────────
const shutdown = () => {
  Logger.info('Shutting down gracefully...');
  container.db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan_security',
      description: 'Scan MCP server configurations for security vulnerabilities (CVEs, auth, typo-squatting, secrets)',
      inputSchema: {
        type: 'object',
        properties: {
          configPath: { type: 'string', description: 'Path to an MCP config file. If omitted, auto-discovers configs.' },
        },
      },
    },
    {
      name: 'audit_costs',
      description: 'Audit token usage and estimate costs per MCP server',
      inputSchema: {
        type: 'object',
        properties: {
          serverName: { type: 'string', description: 'Filter to a specific server name. If omitted, audits all.' },
        },
      },
    },
    {
      name: 'check_health',
      description: 'Check health, latency, and reliability of MCP servers',
      inputSchema: {
        type: 'object',
        properties: {
          serverName: { type: 'string', description: 'Filter to a specific server name. If omitted, checks all.' },
        },
      },
    },
    {
      name: 'full_report',
      description: 'Generate a complete security, cost, and health report for all MCP servers',
      inputSchema: {
        type: 'object',
        properties: {
          configPath: { type: 'string', description: 'Path to MCP config file (optional)' },
          format: { type: 'string', enum: ['json', 'markdown', 'text'], description: 'Output format (default: text)' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Load servers: single config path, aggregated all, or auto-discover
  let servers: McpServerConfig[];
  let configDescription: string;

  if (args?.configPath) {
    servers = ConfigParser.parse(args.configPath as string);
    configDescription = args.configPath as string;
  } else {
    const result = ConfigParser.parseAll();
    servers = result.servers;
    configDescription = result.sourcePaths.length > 1
      ? `aggregated (${result.sourcePaths.length} files)`
      : (result.sourcePaths[0] || 'auto-detected');
  }

  if (servers.length === 0) {
    return {
      content: [{ type: 'text', text: 'No MCP servers found. Please specify a configPath or ensure MCP configs exist.' }],
    };
  }

  switch (name) {
    case 'scan_security': {
      const results = await Promise.all(servers.map((s) => container.securityScanner.scanServer(s)));
      for (const r of results) {
        container.db.addSecurityScan(r.serverName, r.score, r.cves.length, r);
      }
      return { content: [{ type: 'text', text: reporter.formatSecurityReports(results) }] };
    }

    case 'audit_costs': {
      const filtered = args?.serverName ? servers.filter((s) => s.name === args.serverName) : servers;
      const results = await Promise.all(filtered.map((s) => container.costAuditor.auditServer(s)));
      for (const r of results) {
        container.db.addCostRecord(r.serverName, r.tokensUsed, r.estimatedCostUSD);
      }
      return { content: [{ type: 'text', text: reporter.formatCostReports(results) }] };
    }

    case 'check_health': {
      const filtered = args?.serverName ? servers.filter((s) => s.name === args.serverName) : servers;
      const results = await Promise.all(filtered.map((s) => container.healthMonitor.checkServer(s)));
      for (const r of results) {
        container.db.addHealthCheck(r.serverName, r.latencyMs, r.successRate > 0.5, r.toolCount);
      }
      return { content: [{ type: 'text', text: reporter.formatHealthReports(results) }] };
    }

    case 'full_report': {
      const [security, costs, health] = await Promise.all([
        Promise.all(servers.map((s) => container.securityScanner.scanServer(s))),
        Promise.all(servers.map((s) => container.costAuditor.auditServer(s))),
        Promise.all(servers.map((s) => container.healthMonitor.checkServer(s))),
      ]);
      const overallScore = calculateOverallScore(security, health);
      const fullReport: FullReport = {
        timestamp: new Date().toISOString(),
        configPath: configDescription,
        security,
        costs,
        health,
        overallScore,
      };

      // Store results in DB
      for (const r of security) container.db.addSecurityScan(r.serverName, r.score, r.cves.length, r);
      for (const r of costs) container.db.addCostRecord(r.serverName, r.tokensUsed, r.estimatedCostUSD);
      for (const r of health) container.db.addHealthCheck(r.serverName, r.latencyMs, r.successRate > 0.5, r.toolCount);

      const format = (args?.format as string) ?? 'text';

      if (format === 'json') {
        return {
          content: [
            {
              type: 'resource',
              resource: {
                uri: 'report://mcp-doctor/full-report.json',
                mimeType: 'application/json',
                text: JSON.stringify(fullReport, null, 2),
              },
            },
            { type: 'text', text: reporter.formatFullReport(fullReport) },
          ],
        };
      }

      let output: string;
      if (format === 'markdown') {
        output = reporter.toMarkdown(fullReport);
      } else {
        output = reporter.formatFullReport(fullReport);
      }
      return { content: [{ type: 'text', text: output }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  Logger.info('MCP Doctor running on stdio');
}

main().catch((err) => {
  Logger.error(`MCP Doctor failed to start: ${err}`);
  process.exit(1);
});