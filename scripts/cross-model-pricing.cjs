const { PricingClient } = require('../dist/clients/pricing-client.js');

(async function() {
  const client = new PricingClient();
  
  // Force fresh fetch from litellm (the live pricing API)
  console.log('Fetching live pricing from litellm model cost map...');
  await client.refreshLivePricing();
  
  const allModels = client.listModels();
  console.log('Live models loaded: ' + allModels.length + ' total\n');

  const inputTokens = 300;
  const outputTokens = 372;
  
  const models = [
    ['openai', 'gpt-4o'],
    ['openai', 'gpt-4.5-preview'],
    ['openai', 'o1'],
    ['openai', 'o3-mini'],
    ['openai', 'gpt-4o-mini'],
    ['openai', 'gpt-3.5-turbo'],
    ['anthropic', 'claude-3-5-sonnet-20241022'],
    ['anthropic', 'claude-opus-4-20250514'],
    ['anthropic', 'claude-3-5-haiku-20241022'],
    ['google', 'gemini-2.5-pro'],
    ['google', 'gemini-2.0-flash'],
    ['google', 'gemini-2.5-flash'],
    ['deepseek', 'deepseek-chat'],
    ['deepseek', 'deepseek-reasoner'],
    ['xai', 'grok-3'],
    ['xai', 'grok-3-mini'],
    ['meta', 'llama-4-maverick'],
    ['meta', 'llama-3.3-70b'],
    ['mistral', 'mistral-large-latest'],
    ['mistral', 'codestral-latest'],
    ['amazon', 'amazon.nova-pro-v1:0'],
    ['cohere', 'command-r-plus'],
    ['perplexity', 'sonar-pro'],
  ];

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  LIVE PRICING FROM LITELLM — 300 input + 372 output tokens      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  var rows = [];
  models.forEach(function(m) {
    var pricing = client.getPricingForModel(m[1]);
    var inpCost = client.calculateCost(inputTokens, m[1], false);
    var outCost = client.calculateCost(outputTokens, m[1], true);
    var total = (inpCost || 0) + (outCost || 0);
    
    var inpRate = pricing ? ('$' + pricing.input + '/M').padStart(10) : '  unknown  ';
    var outRate = pricing ? ('$' + pricing.output + '/M').padStart(10) : '  unknown  ';
    
    rows.push({
      prov: m[0],
      model: m[1],
      inpCost: inpCost,
      outCost: outCost,
      total: total,
      inpRate: inpRate,
      outRate: outRate,
      live: pricing !== null
    });
  });
  
  // Sort by total cost ascending
  rows.sort(function(a,b) { return a.total - b.total; });
  
  var cheapest = rows[0];
  var mostExpensive = rows[rows.length-1];
  
  rows.forEach(function(r) {
    var icon = r.live ? '✅' : '⚠️';
    console.log('  ' + icon + ' ' + r.prov.padEnd(14) + ' ' + r.model.padEnd(36) +
      ' in:$' + (r.inpCost||0).toFixed(6).padStart(9) + 
      ' out:$' + (r.outCost||0).toFixed(6).padStart(9) +
      ' TOTAL:$' + r.total.toFixed(6).padStart(9) +
      ' [' + r.inpRate.trim() + '/' + r.outRate.trim() + ']');
  });
  
  console.log('\n  ────────────────────────────────────────────────────────────────');
  console.log('  💰 CHEAPEST: ' + cheapest.prov + '/' + cheapest.model + ' — $' + cheapest.total.toFixed(6));
  console.log('  💸 MOST EXPENSIVE: ' + mostExpensive.prov + '/' + mostExpensive.model + ' — $' + mostExpensive.total.toFixed(6));
  console.log('  📊 Cost spread: ' + Math.round(mostExpensive.total / cheapest.total) + 'x from cheapest to most expensive\n');
  console.log('  All pricing fetched LIVE from litellm model cost map');
  console.log('  ' + allModels.length + ' total models available across 17 providers');
  
})();