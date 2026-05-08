import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { ProxyCallRecord } from '../types.js';

export class HistoryDatabase {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private initialized: boolean = false;
  private dirty: boolean = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env['MCP_DOCTOR_DB_PATH'] || path.join(os.homedir(), '.mcp-doctor', 'history.db');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS security_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        server_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        cve_count INTEGER NOT NULL DEFAULT 0,
        details TEXT
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cost_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        server_name TEXT NOT NULL,
        tokens_used INTEGER NOT NULL,
        cost_usd REAL NOT NULL
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        server_name TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        success INTEGER NOT NULL,
        tool_count INTEGER NOT NULL
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS call_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        server_name TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        request_tokens INTEGER NOT NULL DEFAULT 0,
        response_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0
      )
    `);

    this.db.run('CREATE INDEX IF NOT EXISTS idx_security_server ON security_scans(server_name)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_cost_server ON cost_records(server_name)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_health_server ON health_checks(server_name)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_call_server ON call_records(server_name)');

    this.initialized = true;
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.flush();
      }, 1000);
    }
  }

  flush(): void {
    if (this.dirty && this.db) {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, data);
      this.dirty = false;
    }
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  async getRecentSuccessRate(serverName: string): Promise<number> {
    await this.ensureInitialized();
    const result = this.db.exec(
      'SELECT AVG(success) as avg FROM health_checks WHERE server_name = ? ORDER BY timestamp DESC LIMIT 10',
      [serverName]
    );
    if (result.length > 0 && result[0].values.length > 0) {
      const avg = result[0].values[0][0];
      return typeof avg === 'number' ? avg : 1;
    }
    return 1;
  }

  async addSecurityScan(serverName: string, score: number, cveCount: number, details: unknown): Promise<void> {
    await this.ensureInitialized();
    this.db.run(
      'INSERT INTO security_scans (server_name, score, cve_count, details) VALUES (?, ?, ?, ?)',
      [serverName, score, cveCount, JSON.stringify(details)]
    );
    this.scheduleFlush();
  }

  async addCostRecord(serverName: string, tokens: number, cost: number): Promise<void> {
    await this.ensureInitialized();
    this.db.run(
      'INSERT INTO cost_records (server_name, tokens_used, cost_usd) VALUES (?, ?, ?)',
      [serverName, tokens, cost]
    );
    this.scheduleFlush();
  }

  async addHealthCheck(serverName: string, latency: number, success: boolean, toolCount: number): Promise<void> {
    await this.ensureInitialized();
    this.db.run(
      'INSERT INTO health_checks (server_name, latency_ms, success, tool_count) VALUES (?, ?, ?, ?)',
      [serverName, latency, success ? 1 : 0, toolCount]
    );
    this.scheduleFlush();
  }

  /**
   * Store a proxy-intercepted tool call for real cost auditing.
   */
  async addCallRecord(record: ProxyCallRecord): Promise<void> {
    await this.ensureInitialized();
    this.db.run(
      'INSERT INTO call_records (server_name, tool_name, request_tokens, response_tokens, total_tokens, duration_ms) VALUES (?, ?, ?, ?, ?, ?)',
      [record.serverName, record.toolName, record.requestTokens, record.responseTokens, record.totalTokens, record.durationMs]
    );
    this.scheduleFlush();
  }

  /**
   * Get all recorded tool calls for a server for real cost auditing.
   */
  async getCallRecordsForServer(serverName: string): Promise<ProxyCallRecord[]> {
    await this.ensureInitialized();
    const result = this.db.exec(
      'SELECT server_name, tool_name, request_tokens, response_tokens, total_tokens, duration_ms, timestamp FROM call_records WHERE server_name = ?',
      [serverName]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      serverName: row[0] as string,
      toolName: row[1] as string,
      requestTokens: row[2] as number,
      responseTokens: row[3] as number,
      totalTokens: row[4] as number,
      durationMs: row[5] as number,
      timestamp: row[6] as string,
    }));
  }

  close(): void {
    this.flush();
    if (this.db) {
      this.db.close();
      this.initialized = false;
    }
  }
}