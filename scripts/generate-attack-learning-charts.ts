/**
 * Generate PNG figures from reports/attack-learning-eval/metrics.json
 * Run: pnpm exec tsx scripts/generate-attack-learning-charts.ts
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const REPORT_DIR = join(process.cwd(), 'reports', 'attack-learning-eval');
const METRICS_PATH = join(REPORT_DIR, 'metrics.json');
const PY_SCRIPT = join(process.cwd(), 'scripts', 'generate-attack-learning-charts.py');

function main(): void {
  if (!existsSync(METRICS_PATH)) {
    console.error('[charts] Missing metrics.json — run eval:attack-learning:long first');
    process.exit(1);
  }

  const venvPython = join(process.cwd(), '.venv-charts', 'bin', 'python');
  const python = process.env.PYTHON || (existsSync(venvPython) ? venvPython : 'python3');
  const result = spawnSync(python, [PY_SCRIPT], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    console.error('[charts] Python chart generation failed (is matplotlib installed?)');
    console.error('  pip install matplotlib numpy');
    process.exit(result.status ?? 1);
  }
}

main();
