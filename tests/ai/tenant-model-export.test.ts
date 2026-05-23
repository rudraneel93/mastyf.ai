import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../../src/ai/semantic-audit-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ai/semantic-audit-store.js')>();
  return {
    ...actual,
    loadSemanticAuditRecordsAsync: vi.fn(async () => [
      {
        id: 'exp-1',
        tenantId: 'acme',
        requestId: 'r1',
        serverName: 'filesystem',
        toolName: 'read_file',
        syncDecision: { action: 'block', rule: 'path-guard', reason: 'x' },
        semanticAudit: {
          suspicious: true,
          confidence: 0.9,
          categories: ['path-traversal'],
          reasoning: 'bad path',
        },
        timestamp: new Date().toISOString(),
        labeled: true,
        label: 'true_positive' as const,
        argumentsSnapshot: { path: '/etc/passwd' },
      },
    ]),
  };
});

describe('tenant-model-export', () => {
  let dir: string;
  const prevCwd = process.cwd();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lora-export-'));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it('exports JSONL and Modelfile', async () => {
    const { exportTenantTrainingDataset } = await import('../../src/ai/tenant-model-export.js');
    const result = await exportTenantTrainingDataset('acme');
    expect(result.rowsExported).toBe(1);
    expect(readFileSync(result.exportPath, 'utf-8')).toContain('true_positive');
    expect(readFileSync(result.modelfilePath, 'utf-8')).toContain('FROM');
    expect(result.manifest.modelName).toContain('acme');
  });
});
