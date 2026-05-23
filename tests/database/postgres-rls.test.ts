import { describe, it, expect } from 'vitest';
import { isPostgresRlsEnabled } from '../../src/database/postgres-tenant-session.js';

describe('Postgres RLS session', () => {
  it('is disabled unless GUARDIAN_PG_RLS_ENABLED=true', () => {
    const prev = process.env.GUARDIAN_PG_RLS_ENABLED;
    delete process.env.GUARDIAN_PG_RLS_ENABLED;
    expect(isPostgresRlsEnabled()).toBe(false);
    process.env.GUARDIAN_PG_RLS_ENABLED = 'true';
    expect(isPostgresRlsEnabled()).toBe(true);
    if (prev !== undefined) process.env.GUARDIAN_PG_RLS_ENABLED = prev;
    else delete process.env.GUARDIAN_PG_RLS_ENABLED;
  });
});
