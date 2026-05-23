#!/usr/bin/env node
/**
 * Register a Lemon Squeezy Pro license key in cloud Postgres (manual fallback).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... AUTH_SECRET=... node scripts/register-pro-license.mjs \
 *     --key "XXXX-XXXX" --email buyer@example.com
 */
import { createHash, randomUUID } from 'crypto';
import postgres from 'postgres';

function parseArgs(argv) {
  const out = { key: '', email: '', lsLicenseKeyId: '', lsOrderId: '' };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--key' && argv[i + 1]) out.key = argv[++i];
    else if (arg === '--email' && argv[i + 1]) out.email = argv[++i];
    else if (arg === '--ls-license-key-id' && argv[i + 1]) out.lsLicenseKeyId = argv[++i];
    else if (arg === '--ls-order-id' && argv[i + 1]) out.lsOrderId = argv[++i];
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

function hashProLicenseKey(plaintext, secret) {
  return createHash('sha256').update(`${secret}:pro:${plaintext}`).digest('hex');
}

const args = parseArgs(process.argv);
if (args.help || !args.key) {
  console.error(`Usage: DATABASE_URL=... AUTH_SECRET=... node scripts/register-pro-license.mjs \\
  --key "LS-LICENSE-KEY" [--email buyer@example.com] [--ls-license-key-id ID] [--ls-order-id ID]`);
  process.exit(args.help ? 0 : 1);
}

const url = process.env.DATABASE_URL;
const secret = process.env.AUTH_SECRET;
if (!url || !secret) {
  console.error('DATABASE_URL and AUTH_SECRET are required');
  process.exit(1);
}

const keyHash = hashProLicenseKey(args.key.trim(), secret);
const id = randomUUID();
const sql = postgres(url, { max: 1 });

try {
  const rows = await sql`
    INSERT INTO pro_license_keys (id, key_hash, source, purchaser_email, ls_license_key_id, ls_order_id)
    VALUES (
      ${id},
      ${keyHash},
      'lemonsqueezy',
      ${args.email || null},
      ${args.lsLicenseKeyId || null},
      ${args.lsOrderId || null}
    )
    ON CONFLICT (key_hash) DO NOTHING
    RETURNING id
  `;
  if (rows.length === 0) {
    console.log('License already registered (duplicate key_hash)');
  } else {
    console.log(`Registered Pro license id=${rows[0].id}`);
  }
} finally {
  await sql.end();
}
