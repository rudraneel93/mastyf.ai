/**
 * Validates all 100 MCPG-category fixtures from uploaded adversarial analysis.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { CallContext, PolicyConfig } from '../../src/policy/policy-types.js';
import {
  scanToolDefinition,
  toolDefinitionIsMalicious,
} from '../../src/scanners/tool-definition-scanner.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = join(__dir, '../../adversarial-harness/fixtures/mcpg-catalog');
const defaultPolicy = load(
  readFileSync(join(__dir, '../../default-policy.yaml'), 'utf-8'),
) as PolicyConfig;

interface CatalogFixture {
  id: string;
  category: string;
  toolName: string;
  arguments: Record<string, unknown>;
  description?: string;
  expected: 'block';
}

function ctx(toolName: string, args: Record<string, unknown>): CallContext {
  return {
    serverName: 'mcpg-catalog',
    toolName,
    arguments: args,
    requestId: 'mcpg-1',
    requestTokens: 50,
    timestamp: new Date().toISOString(),
  };
}

const fixtures: CatalogFixture[] = readdirSync(CATALOG_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(CATALOG_DIR, f), 'utf8')) as CatalogFixture);

describe('MCPG analysis catalog (100 attacks)', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine(defaultPolicy);
  });

  it('loads 100 catalog fixtures', () => {
    expect(fixtures.length).toBe(100);
  });

  for (const fx of fixtures) {
    it(`PolicyEngine blocks ${fx.id} (${fx.category})`, () => {
      const d = engine.evaluate(ctx(fx.toolName, fx.arguments));
      expect(d.action, `${fx.id}: ${d.rule} — ${d.reason}`).toBe('block');
    });

    if (fx.arguments.description && typeof fx.arguments.description === 'string') {
      it(`scanToolDefinition flags ${fx.id} description`, () => {
        expect(
          toolDefinitionIsMalicious({
            name: fx.toolName,
            description: fx.arguments.description as string,
          }),
        ).toBe(true);
        expect(
          scanToolDefinition({
            name: fx.toolName,
            description: fx.arguments.description as string,
          }).length,
        ).toBeGreaterThan(0);
      });
    }
  }
});
