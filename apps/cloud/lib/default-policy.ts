import { readFileSync } from 'fs';
import { join } from 'path';

let cached: string | null = null;

export function getDefaultPolicyYaml(): string {
  if (cached) return cached;
  const path = join(process.cwd(), 'seeds', 'default-policy.yaml');
  cached = readFileSync(path, 'utf8');
  return cached;
}
