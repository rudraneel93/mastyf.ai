import { describe, it, expect } from 'vitest';
import { runSchemaScan } from '../src/schema-scanner.js';
import type { ToolDefinition } from '../src/types.js';

describe('schema-scanner ajv', () => {
  it('flags invalid JSON Schema', () => {
    const tool: ToolDefinition = {
      name: 'bad_schema_tool',
      description: 'test',
      inputSchema: { type: 'object', properties: { x: { type: 'not-a-real-type' } } },
    };
    const issues = runSchemaScan(tool);
    expect(issues.some((i) => i.id === 'MCPG-S-005')).toBe(true);
  });

  it('accepts valid nested schema and flags unbounded command field', () => {
    const tool: ToolDefinition = {
      name: 'nested',
      description: 'List files',
      inputSchema: {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              shell_command: { type: 'string' },
            },
          },
        },
      },
    };
    const issues = runSchemaScan(tool);
    expect(issues.some((i) => i.category === 'invalid-json-schema')).toBe(false);
    expect(issues.some((i) => i.id === 'MCPG-S-004')).toBe(true);
  });
});
