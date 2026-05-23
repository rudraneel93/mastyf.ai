/**
 * Export visuals-data.json for matplotlib + dashboard charts.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSwarmDir } from '../lib/swarm-dir.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const OUT = join(resolveSwarmDir(), 'visuals-data.json');

export async function writeVisualsDataBundle(opts = {}) {
  const { buildVisualsData } = await import('../../dist/utils/export-visuals-data.js');
  const bundle = await buildVisualsData(opts);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(bundle, null, 2));
  return bundle;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeVisualsDataBundle().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
