#!/usr/bin/env node
/** Wait until a package version appears on the npm registry (replication delay). */
const [name, version] = process.argv.slice(2);
if (!name || !version) {
  console.error('Usage: node scripts/wait-npm-registry.mjs <package> <version> [maxAttempts]');
  process.exit(1);
}
const maxAttempts = Number(process.argv[4] ?? 12);
const delayMs = 5000;

for (let i = 1; i <= maxAttempts; i++) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
  if (res.ok) {
    console.log(`[wait-npm-registry] ${name}@${version} visible (${i}/${maxAttempts})`);
    process.exit(0);
  }
  if (i < maxAttempts) {
    console.error(`[wait-npm-registry] ${name}@${version} not visible yet, retry in ${delayMs / 1000}s (${i}/${maxAttempts})...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}
console.error(`[wait-npm-registry] ${name}@${version} not found after ${maxAttempts} attempts`);
process.exit(1);
