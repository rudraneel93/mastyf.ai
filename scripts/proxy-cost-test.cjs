const { McpProxyServer } = require('../dist/proxy/proxy-server.js');
const { HistoryDatabase } = require('../dist/database/history-db.js');
const { PolicyEngine } = require('../dist/policy/policy-engine.js');
const { readFileSync } = require('fs');
const { load } = require('js-yaml');

const db = new HistoryDatabase(':memory:');
const policyYaml = readFileSync(__dirname + '/../default-policy.yaml', 'utf-8');
const policyConfig = load(policyYaml);
policyConfig.policy.mode = 'block';
const engine = new PolicyEngine(policyConfig);

// Simple echo MCP server
const echoServerCode = [
  'const rl = require("readline").createInterface({input:process.stdin});',
  'rl.on("line", function(l) {',
  '  try {',
  '    var m = JSON.parse(l);',
  '    process.stdout.write(JSON.stringify({',
  '      jsonrpc:"2.0", id:m.id,',
  '      result:{content:[{type:"text",text:JSON.stringify(m.params && m.params.arguments || {})}]}',
  '    }) + "\\n");',
  '  } catch(e){}',
  '});',
].join('');

const proxy = new McpProxyServer(
  'node', ['-e', echoServerCode],
  { PATH: process.env.PATH, HOME: process.env.HOME },
  db, 'echo-server', engine
);

setTimeout(async function() {
  var calls = [
    { id: '1', method: 'tools/call', params: { name: 'search', arguments: { query: 'hello world' } } },
    { id: '2', method: 'tools/call', params: { name: 'execute_command', arguments: { command: 'ls' } } },
    { id: '3', method: 'tools/call', params: { name: 'read_file', arguments: { path: 'test.txt' } } },
    { id: '4', method: 'tools/call', params: { name: 'search', arguments: { query: 'rm -rf /' } } },
  ];

  for (var i = 0; i < calls.length; i++) {
    await proxy.handleClientInput(JSON.stringify(calls[i]));
  }

  setTimeout(async function() {
    var { CostAuditor } = require('../dist/services/cost-auditor.js');
    var { PricingClient } = require('../dist/clients/pricing-client.js');
    var pricing = new PricingClient();
    var auditor = new CostAuditor(pricing, db);

    var records = await db.getCallRecordsForServer('echo-server');
    console.log('=== PROXY CAPTURED CALL RECORDS (live) ===');
    records.forEach(function(r) {
      console.log('  Tool: ' + r.toolName + ' | Input: ' + r.requestTokens + ' tokens | Output: ' + r.responseTokens + ' tokens | Total: ' + r.totalTokens + ' tokens | Duration: ' + r.durationMs + 'ms');
    });

    var report = await auditor.auditServer({ name: 'echo-server', transport: 'stdio' });
    console.log('\n=== COST AUDIT FROM PROXY DATA ===');
    console.log('  Server: ' + report.serverName);
    console.log('  Total Tokens: ' + report.tokensUsed);
    console.log('  Input: ' + report.inputTokens + ', Output: ' + report.outputTokens);
    console.log('  Estimated Cost: $' + report.estimatedCostUSD.toFixed(6));
    console.log('  Pricing Model: ' + report.pricingModel);
    console.log('  Tool Breakdown:');
    report.toolBreakdown.forEach(function(t) {
      console.log('    ' + t.toolName + ': ' + t.calls + ' calls, ' + t.tokens + ' tokens, $' + t.cost.toFixed(6));
    });
    console.log('\n  Note: ' + (report.note || 'Live proxy data captured!'));

    db.close();
    proxy.kill();
    process.exit(0);
  }, 800);
}, 800);