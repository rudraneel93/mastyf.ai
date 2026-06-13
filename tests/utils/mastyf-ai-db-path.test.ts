import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveMastyfAiDbPath,
  getDefaultMastyfAiDbPath,
  resolveMcpServerDbPath,
} from '../../src/utils/mastyf-ai-db-path.js';
import { homedir } from 'os';
import { join } from 'path';

describe('resolveMastyfAiDbPath', () => {
  const prev = process.env.MASTYF_AI_DB_PATH;

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYF_AI_DB_PATH;
    else process.env.MASTYF_AI_DB_PATH = prev;
  });

  it('uses explicit path when provided', () => {
    expect(resolveMastyfAiDbPath('/tmp/custom.db')).toBe('/tmp/custom.db');
  });

  it('uses MASTYF_AI_DB_PATH env when set', () => {
    process.env.MASTYF_AI_DB_PATH = '/tmp/env.db';
    expect(resolveMastyfAiDbPath()).toBe('/tmp/env.db');
  });

  it('defaults to ~/.mastyf-ai/history.db', () => {
    delete process.env.MASTYF_AI_DB_PATH;
    expect(resolveMastyfAiDbPath()).toBe(getDefaultMastyfAiDbPath());
  });

  it('resolveMcpServerDbPath uses separate mcp-server.db under home', () => {
    delete process.env.MASTYF_AI_DB_PATH;
    expect(resolveMcpServerDbPath()).toBe(join(homedir(), '.mastyf-ai', 'mcp-server.db'));
  });
});
