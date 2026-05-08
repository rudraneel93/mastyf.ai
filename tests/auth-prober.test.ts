import { describe, it, expect } from 'vitest';
import { AuthProber } from '../src/scanners/auth-prober.js';

describe('AuthProber', () => {
  const prober = new AuthProber();

  it('detects auth via environment API key', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'stdio',
      env: { API_KEY: 'my-secret-key' },
    });
    expect(result.hasAuthentication).toBe(true);
    expect(result.method).toBe('environment_variable');
  });

  it('detects auth via AUTH_TOKEN env var', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'stdio',
      env: { AUTH_TOKEN: 'bearer-token-123' },
    });
    expect(result.hasAuthentication).toBe(true);
  });

  it('detects auth via MCP_API_KEY env var', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'stdio',
      env: { MCP_API_KEY: 'mcp-key-456' },
    });
    expect(result.hasAuthentication).toBe(true);
  });

  it('detects no auth when env is empty', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'stdio',
      env: { HOME: '/home/user' },
    });
    expect(result.hasAuthentication).toBe(false);
  });

  it('detects no auth when env is undefined', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'stdio',
    });
    expect(result.hasAuthentication).toBe(false);
  });

  it('detects auth via URL credentials', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'sse',
      url: 'https://user:pass@api.example.com/mcp',
    });
    expect(result.hasAuthentication).toBe(true);
    expect(result.method).toBe('url_credentials');
  });

  it('detects auth via query parameters', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'sse',
      url: 'https://api.example.com/mcp?api_key=secret123',
    });
    expect(result.hasAuthentication).toBe(true);
    expect(result.method).toBe('query_parameter');
  });

  it('reports HTTP transport as unencrypted', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'sse',
      url: 'http://api.example.com/mcp',
    });
    expect(result.isTransportEncrypted).toBe(false);
  });

  it('reports HTTPS transport as encrypted', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'sse',
      url: 'https://api.example.com/mcp',
    });
    expect(result.isTransportEncrypted).toBe(true);
  });

  it('reports stdio transport as encrypted (local pipe)', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'stdio',
    });
    expect(result.isTransportEncrypted).toBe(true);
  });

  it('reports WSS transport as encrypted', () => {
    const result = prober.probe({
      name: 'test',
      transport: 'sse',
      url: 'wss://api.example.com/mcp',
    });
    expect(result.isTransportEncrypted).toBe(true);
  });
});