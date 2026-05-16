import { HistoryDatabase } from './history-db.js';
import { PostgresDatabase } from './postgres-db.js';
import { IDatabase } from './database-interface.js';
import { Logger } from '../utils/logger.js';

export async function createDatabase(dbPath?: string): Promise<IDatabase> {
  const dbType = (process.env['DB_TYPE'] || 'sqlite').toLowerCase();

  if (dbType === 'postgres') {
    const pg = new PostgresDatabase();
    await pg.initialize();
    Logger.info('[database] Using PostgreSQL backend');
    return pg;
  }

  const effectivePath = dbPath ?? process.env['MCP_GUARDIAN_DB_PATH'] ?? undefined;
  const sqlite = new HistoryDatabase(effectivePath);
  Logger.info(`[database] Using SQLite backend${effectivePath ? ` at ${effectivePath}` : ''}`);
  return sqlite;
}

export function createDatabaseSync(dbPath?: string): HistoryDatabase {
  const dbType = (process.env['DB_TYPE'] || 'sqlite').toLowerCase();
  if (dbType === 'postgres') {
    Logger.warn('[database] DB_TYPE=postgres requires createDatabase() — falling back to SQLite for sync init');
  }
  return new HistoryDatabase(dbPath ?? process.env['MCP_GUARDIAN_DB_PATH'] ?? undefined);
}
