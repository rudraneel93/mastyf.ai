import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PolicyWatcher } from '../../src/policy/policy-watcher.js';

const baseYaml = `version: "1.0"
policy:
  mode: block
  rules:
    - name: deny-eval
      action: block
      tools:
        deny: [eval]
`;

describe('PolicyWatcher hot reload', () => {
  let dir: string;
  let policyPath: string;
  let watcher: PolicyWatcher | null = null;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'guardian-policy-'));
    policyPath = join(dir, 'policy.yaml');
    writeFileSync(policyPath, baseYaml, 'utf-8');
    watcher = new PolicyWatcher(policyPath);
  });

  afterEach(() => {
    watcher?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('evaluate during reload never returns reload-in-progress block', async () => {
    const ctx = {
      serverName: 's',
      toolName: 'eval',
      arguments: {},
      requestId: 'r1',
      requestTokens: 1,
      timestamp: new Date().toISOString(),
    };

    writeFileSync(
      policyPath,
      baseYaml.replace('deny: [eval]', 'deny: [eval, execute_command]'),
      'utf-8',
    );
    await watcher!.forceReloadForTests();

    const decisions = await Promise.all(
      Array.from({ length: 50 }, async () => {
        await new Promise((r) => setImmediate(r));
        const engine = watcher!.get();
        if (!engine) return { action: 'pass' as const, rule: 'none', reason: '' };
        return engine.evaluate(ctx);
      }),
    );

    for (const d of decisions) {
      expect(d.reason?.toLowerCase() ?? '').not.toMatch(/reload/);
      expect(d.rule).not.toBe('reload-in-progress');
    }
    expect(decisions.some((d) => d.action === 'block')).toBe(true);
  });

  it('atomically swaps engine after file change', async () => {
    const before = watcher!.get()!;
    writeFileSync(
      policyPath,
      `version: "1.0"
policy:
  mode: audit
  rules: []
`,
      'utf-8',
    );

    await watcher!.forceReloadForTests();
    const after = watcher!.get()!;
    expect(after).not.toBe(before);
    expect(after.getMode()).toBe('audit');
  });
});
