import { describe, expect, it } from 'vitest';
import { buildSignatureHints, catalogFromFleetRows } from '../../src/utils/federated-signature-exchange.js';

describe('federated-signature-exchange', () => {
  it('builds hints for fleet-wide signatures not seen locally', () => {
    const catalog = catalogFromFleetRows([
      {
        signature_id: 'sig-abc',
        rule_name: 'semantic-flag',
        tool_name: 'read_file',
        category: 'path-traversal',
        arg_shape_hash: 'hash1',
        instance_count: 3,
        event_count: 12,
        last_seen: new Date().toISOString(),
      },
    ]);
    const hints = buildSignatureHints(catalog, new Set(), 2);
    expect(hints.length).toBe(1);
    expect(hints[0].message).toContain('3 fleet instances');
  });
});
