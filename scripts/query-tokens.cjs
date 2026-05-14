#!/usr/bin/env node
const Database = require('better-sqlite3');

for (const db of ['github', 'filesystem']) {
  const path = '/private/tmp/proxy-' + db + '.db';
  try {
    const dbh = new Database(path, { readonly: true });
    const rows = dbh.prepare('SELECT * FROM call_records ORDER BY id DESC').all();
    console.log('=== proxy-' + db + ' ===');
    console.log('Total calls:', rows.length);
    if (rows.length > 0) {
      const totalTokens = rows.reduce((s, r) => s + (r.total_tokens || 0), 0);
      const totalReq = rows.reduce((s, r) => s + (r.request_tokens || 0), 0);
      const totalResp = rows.reduce((s, r) => s + (r.response_tokens || 0), 0);
      console.log('Total tokens:', totalTokens);
      console.log('Request tokens:', totalReq);
      console.log('Response tokens:', totalResp);
      console.log('Sample calls:');
      rows.slice(0, 5).forEach(r => console.log('  ' + r.tool_name + ' | req:' + r.request_tokens + ' resp:' + r.response_tokens + ' total:' + r.total_tokens + ' | ' + r.duration_ms + 'ms'));
    }
    dbh.close();
  } catch (e) {
    console.log('=== proxy-' + db + ' === ERROR:', e.message);
  }
  console.log('');
}