import { describe, it, expect } from 'vitest';
import { decodeConfigFile } from '../../src/utils/config-encoding.js';

describe('decodeConfigFile', () => {
  it('decodes UTF-16 LE JSON', () => {
    const buf = Buffer.from('{\n  "mcpServers": {}\n}\n', 'utf16le');
    const withBom = Buffer.concat([Buffer.from([0xff, 0xfe]), buf]);
    expect(decodeConfigFile(withBom)).toContain('mcpServers');
  });

  it('decodes UTF-8 with BOM', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"a":1}', 'utf8')]);
    expect(decodeConfigFile(buf)).toBe('{"a":1}');
  });
});
