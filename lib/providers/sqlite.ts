import { createClient, type Client, type Config } from "@libsql/client";
import { DBConfig } from "@/types";
import { DatabaseProvider, ExecuteQueryResult, QueryFieldInfo, QueryResult } from "../db-provider";

function escId(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export class SQLiteProvider implements DatabaseProvider {
  readonly type = "sqlite" as const;
  private client: Client | null = null;

  createPool(config: DBConfig): void {
    const url = this.resolveUrl(config);
    const clientConfig: Config = { url };

    if (config.authToken) {
      clientConfig.authToken = config.authToken;
    }

    this.client = createClient(clientConfig);
  }

  async testConnection(config: DBConfig): Promise<boolean> {
    const url = this.resolveUrl(config);
    const clientConfig: Config = { url };
    if (config.authToken) {
      clientConfig.authToken = config.authToken;
    }

    const testClient = createClient(clientConfig);
    try {
      await testClient.execute("SELECT 1");
      return true;
    } finally {
      testClient.close();
    }
  }

  getPool(): Client | null {
    return this.client;
  }

  async endPool(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  // --- Schema introspection ---

  async getSchemas(): Promise<string[]> {
    return ["main"];
  }

  async getTables(_schema: string): Promise<string[]> {
    const result = await this.client!.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' AND name NOT LIKE 'libsql_%' ORDER BY name"
    );
    return result.rows.map((r) => r.name as string);
  }

  async getViews(_schema: string): Promise<string[]> {
    const result = await this.client!.execute(
      "SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name"
    );
    return result.rows.map((r) => r.name as string);
  }

  async getMaterializedViews(_schema: string): Promise<string[]> {
    return [];
  }

  async getFunctions(_schema: string): Promise<any[]> {
    return [];
  }

  async getTableSchema(tableName: string, _schema: string): Promise<any[]> {
    const result = await this.client!.execute(`PRAGMA table_info(${escId(tableName)})`);
    return result.rows.map((col: any) => ({
      column_name: col.name,
      data_type: col.type || "TEXT",
      is_nullable: col.notnull === 0 ? "YES" : "NO",
      column_default: col.dflt_value,
      is_primary_key: (col.pk as number) > 0,
    }));
  }

  async getTableRelationships(tableName: string, _schema: string): Promise<any[]> {
    const result = await this.client!.execute(`PRAGMA foreign_key_list(${escId(tableName)})`);
    return result.rows.map((fk: any) => ({
      constraint_name: `fk_${tableName}_${fk.from}_${fk.table}_${fk.to}`,
      source_column: fk.from,
      target_schema: "main",
      target_table: fk.table,
      target_column: fk.to,
    }));
  }

  async getTableData(
    tableName: string,
    limit: number = 100,
    offset: number = 0,
    sortColumn?: string,
    sortDirection?: "asc" | "desc",
    _schema: string = "main"
  ): Promise<{ rows: any[]; total: number; countIsEstimate?: boolean }> {
    const table = escId(tableName);

    const countResult = await this.client!.execute(`SELECT COUNT(*) as count FROM ${table}`);
    const total = Number(countResult.rows[0].count);

    let query = `SELECT * FROM ${table}`;

    if (sortColumn && sortDirection) {
      const colsResult = await this.client!.execute(`PRAGMA table_info(${table})`);
      const validCol = colsResult.rows.find((c: any) => c.name === sortColumn);
      if (validCol) {
        query += ` ORDER BY ${escId(sortColumn)} ${sortDirection === "desc" ? "DESC" : "ASC"}`;
      }
    }

    query += ` LIMIT ${limit} OFFSET ${offset}`;
    const result = await this.client!.execute(query);

    // Convert libsql rows to plain objects
    const rows = result.rows.map((row) => {
      const obj: Record<string, any> = {};
      for (const col of result.columns) {
        obj[col] = (row as any)[col];
      }
      return obj;
    });

    return { rows, total, countIsEstimate: false };
  }

  async getTableIndexes(tableName: string, _schema: string): Promise<any[]> {
    const result = await this.client!.execute(`PRAGMA index_list(${escId(tableName)})`);

    const indexes = [];
    for (const idx of result.rows) {
      const colsResult = await this.client!.execute(
        `PRAGMA index_info(${escId(idx.name as string)})`
      );
      indexes.push({
        index_name: idx.name,
        index_type: "btree",
        is_unique: idx.unique === 1,
        is_primary: idx.origin === "pk",
        columns: colsResult.rows.map((c: any) => c.name),
      });
    }
    return indexes;
  }

  async getTableStats(tableName: string, _schema: string): Promise<any> {
    const table = escId(tableName);
    const countResult = await this.client!.execute(`SELECT COUNT(*) as count FROM ${table}`);
    const rowCount = Number(countResult.rows[0].count);

    return {
      total_size: "N/A",
      table_size: "N/A",
      index_size: "N/A",
      estimated_rows: rowCount,
      seq_scan: 0,
      idx_scan: 0,
      live_rows: rowCount,
      dead_rows: 0,
      last_vacuum: null,
      last_autovacuum: null,
      last_analyze: null,
      last_autoanalyze: null,
    };
  }

  // --- Query execution ---

  async executeQuery(
    query: string,
    _timeout?: number
  ): Promise<ExecuteQueryResult> {
    const startTime = Date.now();
    const trimmed = query.trim();

    if (/^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed)) {
      const result = await this.client!.execute(trimmed);
      const rows = result.rows.map((row) => {
        const obj: Record<string, any> = {};
        for (const col of result.columns) {
          obj[col] = (row as any)[col];
        }
        return obj;
      });
      // libsql does not expose column origin metadata, so source is always null.
      const fields: QueryFieldInfo[] = result.columns.map((name) => ({
        name,
        dataTypeID: null,
        source: null,
      }));
      return { rows, executionTime: Date.now() - startTime, fields };
    }

    const result = await this.client!.execute(trimmed);
    return {
      rows: [{ changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid ?? 0) }],
      executionTime: Date.now() - startTime,
    };
  }

  async executeExplain(
    query: string,
    _timeout?: number
  ): Promise<{ plan: any; executionTime: number }> {
    const startTime = Date.now();
    const result = await this.client!.execute(`EXPLAIN QUERY PLAN ${query}`);
    const rows = result.rows.map((row) => {
      const obj: Record<string, any> = {};
      for (const col of result.columns) {
        obj[col] = (row as any)[col];
      }
      return obj;
    });
    return {
      plan: rows,
      executionTime: Date.now() - startTime,
    };
  }

  async query(sql: string, params: any[]): Promise<QueryResult> {
    const trimmed = sql.trim();

    if (/^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed)) {
      const result = await this.client!.execute({ sql: trimmed, args: params });
      const rows = result.rows.map((row) => {
        const obj: Record<string, any> = {};
        for (const col of result.columns) {
          obj[col] = (row as any)[col];
        }
        return obj;
      });
      return { rows, rowCount: rows.length };
    }

    const result = await this.client!.execute({ sql: trimmed, args: params });
    return { rows: [], rowCount: result.rowsAffected };
  }

  async getTableRowCounts(_schema: string): Promise<Record<string, number>> {
    // SQLite has no cheap row-count estimate. Run an actual COUNT(*) per
    // table — fine for typical dev databases, expensive for very large
    // ones. Returns whatever we managed to count; failures are skipped so
    // a single bad table doesn't poison the rest of the result.
    const counts: Record<string, number> = {};
    const tables = await this.client!.execute(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    );
    for (const row of tables.rows) {
      const name = String((row as any).name);
      try {
        const r = await this.client!.execute(
          `SELECT COUNT(*) AS c FROM ${escId(name)}`
        );
        const c = Number((r.rows[0] as any)?.c ?? 0);
        if (!isNaN(c)) counts[name] = c;
      } catch {
        // skip — leave count missing
      }
    }
    return counts;
  }

  async runTransaction(
    statements: { sql: string; params: any[] }[]
  ): Promise<{ rowCounts: number[] }> {
    const tx = await this.client!.transaction("write");
    try {
      const rowCounts: number[] = [];
      for (const stmt of statements) {
        const result = await tx.execute({ sql: stmt.sql, args: stmt.params });
        rowCounts.push(result.rowsAffected ?? 0);
      }
      await tx.commit();
      return { rowCounts };
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // best effort
      }
      throw err;
    }
  }

  // --- Health check ---

  getHealthInfo(): { totalCount: number; idleCount: number } {
    return { totalCount: this.client ? 1 : 0, idleCount: this.client ? 1 : 0 };
  }

  async healthPing(): Promise<void> {
    await this.client!.execute("SELECT 1");
  }

  // --- Private helpers ---

  private resolveUrl(config: DBConfig): string {
    const filepath = config.filepath || "";

    // Already a libsql:// or https:// URL (Turso remote)
    if (/^(libsql|https?):\/\//i.test(filepath)) {
      return filepath;
    }

    // Local file path — use file: protocol
    if (filepath) {
      return `file:${filepath}`;
    }

    throw new Error("SQLite file path or libsql:// URL is required");
  }
}
