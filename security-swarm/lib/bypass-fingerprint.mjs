/**
 * Stable bypass fingerprints for baseline comparison and evasion promotion dedup.
 */
import { createHash } from 'node:crypto';

export function bypassFingerprint(b) {
  if (b.fingerprint) return b.fingerprint;
  if (b.id) return `id:${b.id}`;
  if (b.fixtureId) return `fixture:${b.fixtureId}`;
  const tool = b.toolName || b.tool || '';
  const args = b.arguments ?? b.args ?? b.payload;
  const argsKey =
    typeof args === 'string'
      ? args
      : args && typeof args === 'object'
        ? JSON.stringify(args)
        : '';
  if (tool || argsKey) {
    const h = createHash('sha256').update(`${tool}\0${argsKey}`).digest('hex').slice(0, 16);
    return `call:${tool}:${h}`;
  }
  return `raw:${createHash('sha256').update(JSON.stringify(b)).digest('hex').slice(0, 16)}`;
}

export function diffBypasses(current, baselineFingerprints) {
  const baseline = new Set(baselineFingerprints);
  const netNew = [];
  const known = [];
  for (const b of current) {
    const fp = bypassFingerprint(b);
    const entry = { ...b, fingerprint: fp };
    if (baseline.has(fp)) known.push(entry);
    else netNew.push(entry);
  }
  return { netNew, known };
}
