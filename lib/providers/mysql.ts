import mysql from "mysql2/promise";
import type { Pool, PoolOptions } from "mysql2/promise";
import { DBConfig } from "@/types";
import {
  DatabaseProvider,
  ExecuteQueryResult,
  IncomingForeignKey,
  QueryFieldInfo,
  QueryResult,
  normalizeDeleteRule,
} from "../db-provider";

function escId(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

export class MySQLProvider implements DatabaseProvider {
  readonly type = "mysql" as const;
  private pool: Pool | null = null;

  createPool(config: DBConfig): void {
    const poolOpts: PoolOptions = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      connectionLimit: 20,
      connectTimeout: 5000,
      waitForConnections: true,
    };

    if (config.ssl === true) {
      poolOpts.ssl = { rejectUnauthorized: false };
    } else if (typeof config.ssl === "object") {
      poolOpts.ssl = config.ssl as any;
    }

    this.pool = mysql.createPool(poolOpts);
  }

  async testConnection(config: DBConfig): Promise<boolean> {
    const provider = new MySQLProvider();
    provider.createPool({
      ...config,
      ssl: config.ssl !== undefined ? config.ssl : false,
    });
    try {
      const conn = await provider.pool!.getConnection();
      await conn.query("SELECT NOW()");
      conn.release();
      await provider.pool!.end();
      return true;
    } catch {
      await provider.pool?.end().catch(() => {});
      return false;
    }
  }

  getPool(): Pool | null {
    return this.pool;
  }

  async endPool(): Promise<void> {
    if (this.pool) {
      await this.pool.end().catch(() => {});
      this.pool = null;
    }
  }

  // --- Schema introspection ---

  async getSchemas(): Promise<string[]> {
    const [rows] = await this.pool!.query("SHOW DATABASES");
    const systemDbs = [
      "information_schema",
      "mysql",
      "performance_schema",
      "sys",
    ];
    return (rows as any[])
      .map((r) => r.Database)
      .filter((name: string) => !systemDbs.includes(name))
      .sort();
  }

  async getTables(schema: string): Promise<string[]> {
    const [rows] = await this.pool!.query(
      `SELECT TABLE_NAME as table_name
       FROM information_schema.tables
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [schema]
    );
    return (rows as any[]).map((r) => r.table_name);
  }

  async getViews(schema: string): Promise<string[]> {
    const [rows] = await this.pool!.query(
      `SELECT TABLE_NAME as table_name
       FROM information_schema.views
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [schema]
    );
    return (rows as any[]).map((r) => r.table_name);
  }

  async getMaterializedViews(_schema: string): Promise<string[]> {
    return []; // MySQL does not support materialized views
  }

  async getFunctions(schema: string): Promise<any[]> {
    const [rows] = await this.pool!.query(
      `SELECT
         ROUTINE_NAME as name,
         '' as arguments,
         DTD_IDENTIFIER as return_type,
         COALESCE(EXTERNAL_LANGUAGE, 'SQL') as language,
         LOWER(ROUTINE_TYPE) as kind
       FROM information_schema.ROUTINES
       WHERE ROUTINE_SCHEMA = ?
       ORDER BY ROUTINE_NAME`,
      [schema]
    );
    return rows as any[];
  }

  async getTableSchema(
    tableName: string,
    schema: string
  ): Promise<any[]> {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }

    const [rows] = await this.pool!.query(
      `SELECT
         c.COLUMN_NAME as column_name,
         c.DATA_TYPE as data_type,
         c.IS_NULLABLE as is_nullable,
         c.COLUMN_DEFAULT as column_default,
         CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN true ELSE false END as is_primary_key
       FROM information_schema.COLUMNS c
       LEFT JOIN (
         SELECT ku.COLUMN_NAME
         FROM information_schema.TABLE_CONSTRAINTS tc
         JOIN information_schema.KEY_COLUMN_USAGE ku
           ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
           AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
         WHERE tc.TABLE_NAME = ?
           AND tc.TABLE_SCHEMA = ?
           AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
       ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
       WHERE c.TABLE_NAME = ? AND c.TABLE_SCHEMA = ?
       ORDER BY c.ORDINAL_POSITION`,
      [tableName, schema, tableName, schema]
    );
    return rows as any[];
  }

  async getTableRelationships(
    tableName: string,
    schema: string
  ): Promise<any[]> {
    const [rows] = await this.pool!.query(
      `SELECT
         kcu.CONSTRAINT_NAME as constraint_name,
         kcu.COLUMN_NAME as source_column,
         kcu.REFERENCED_TABLE_SCHEMA as target_schema,
         kcu.REFERENCED_TABLE_NAME as target_table,
         kcu.REFERENCED_COLUMN_NAME as target_column
       FROM information_schema.KEY_COLUMN_USAGE kcu
       JOIN information_schema.TABLE_CONSTRAINTS tc
         ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
         AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
       WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND kcu.TABLE_NAME = ?
         AND kcu.TABLE_SCHEMA = ?
       ORDER BY kcu.CONSTRAINT_NAME`,
      [tableName, schema]
    );
    return rows as any[];
  }

  async getIncomingForeignKeys(
    tableName: string,
    schema: string
  ): Promise<IncomingForeignKey[]> {
    const [rows] = await this.pool!.query(
      `SELECT
         rc.CONSTRAINT_NAME       AS constraint_name,
         kcu.TABLE_SCHEMA         AS child_schema,
         kcu.TABLE_NAME           AS child_table,
         kcu.COLUMN_NAME          AS child_column,
         kcu.REFERENCED_COLUMN_NAME AS parent_column,
         rc.DELETE_RULE           AS delete_rule
       FROM information_schema.REFERENTIAL_CONSTRAINTS rc
       JOIN information_schema.KEY_COLUMN_USAGE kcu
         ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
         AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
         AND kcu.TABLE_NAME = rc.TABLE_NAME
       WHERE kcu.REFERENCED_TABLE_NAME = ?
         AND kcu.REFERENCED_TABLE_SCHEMA = ?
       ORDER BY rc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
      [tableName, schema]
    );
    return (rows as any[]).map((r) => ({
      constraintName: r.constraint_name,
      childSchema: r.child_schema,
      childTable: r.child_table,
      childColumn: r.child_column,
      parentColumn: r.parent_column,
      deleteRule: normalizeDeleteRule(r.delete_rule),
    }));
  }

  async getTableData(
    tableName: string,
    limit: number = 100,
    offset: number = 0,
    sortColumn?: string,
    sortDirection?: "asc" | "desc",
    schema: string = ""
  ): Promise<{ rows: any[]; total: number; countIsEstimate?: boolean }> {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }
    if (schema && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      throw new Error("Invalid schema name");
    }

    const qualifiedTable = `${escId(schema)}.${escId(tableName)}`;

    // Estimated count from information_schema
    let total: number;
    let countIsEstimate = false;

    const [estRows] = await this.pool!.query(
      `SELECT TABLE_ROWS as estimate
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [schema, tableName]
    );
    const estimate = parseInt(
      (estRows as any[])[0]?.estimate || "0",
      10
    );

    if (estimate > 10000) {
      total = estimate;
      countIsEstimate = true;
    } else {
      const [countRows] = await this.pool!.query(
        `SELECT COUNT(*) as count FROM ${qualifiedTable}`
      );
      total = parseInt((countRows as any[])[0].count, 10);
    }

    let query = `SELECT * FROM ${qualifiedTable}`;

    if (sortColumn && sortDirection) {
      // Validate column exists
      const [colCheck] = await this.pool!.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [schema, tableName, sortColumn]
      );
      if ((colCheck as any[]).length > 0) {
        query += ` ORDER BY ${escId(sortColumn)} ${sortDirection === "desc" ? "DESC" : "ASC"}`;
      }
    }

    query += ` LIMIT ? OFFSET ?`;
    const [dataRows] = await this.pool!.query(query, [limit, offset]);

    return {
      rows: dataRows as any[],
      total,
      countIsEstimate,
    };
  }

  async getTableIndexes(
    tableName: string,
    schema: string
  ): Promise<any[]> {
    const [rows] = await this.pool!.query(
      `SELECT
         INDEX_NAME as index_name,
         INDEX_TYPE as index_type,
         CASE WHEN NON_UNIQUE = 0 THEN true ELSE false END as is_unique,
         CASE WHEN INDEX_NAME = 'PRIMARY' THEN true ELSE false END as is_primary,
         GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       GROUP BY INDEX_NAME, INDEX_TYPE, NON_UNIQUE
       ORDER BY INDEX_NAME`,
      [schema, tableName]
    );
    return (rows as any[]).map((r: any) => ({
      ...r,
      columns:
        typeof r.columns === "string" ? r.columns.split(",") : r.columns,
    }));
  }

  async getTableStats(
    tableName: string,
    schema: string
  ): Promise<any> {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      throw new Error("Invalid schema name");
    }

    const [rows] = await this.pool!.query(
      `SELECT
         CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2), ' MB') as total_size,
         CONCAT(ROUND(DATA_LENGTH / 1024 / 1024, 2), ' MB') as table_size,
         CONCAT(ROUND(INDEX_LENGTH / 1024 / 1024, 2), ' MB') as index_size,
         TABLE_ROWS as estimated_rows,
         0 as seq_scan,
         0 as idx_scan,
         TABLE_ROWS as live_rows,
         0 as dead_rows,
         NULL as last_vacuum,
         NULL as last_autovacuum,
         UPDATE_TIME as last_analyze,
         NULL as last_autoanalyze
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [schema, tableName]
    );
    return (rows as any[])[0] || null;
  }

  // --- Query execution ---

  async executeQuery(
    query: string,
    timeout: number = 30000
  ): Promise<ExecuteQueryResult> {
    const conn = await this.pool!.getConnection();
    const startTime = Date.now();

    try {
      const [idRows] = await conn.query(
        "SELECT CONNECTION_ID() as id"
      );
      const connectionId = (idRows as any[])[0].id;

      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(async () => {
          try {
            await this.pool!.query(`KILL QUERY ${connectionId}`);
          } catch {
            // best effort
          }
          conn.release();
          reject(new Error("Query timeout exceeded"));
        }, timeout);
      });

      const raced = (await Promise.race([
        conn.query(query),
        timeoutPromise,
      ])) as any;
      clearTimeout(timer!);
      const [rows, fieldMeta] = raced as [any, any[] | undefined];
      const executionTime = Date.now() - startTime;
      const fields: QueryFieldInfo[] | undefined = Array.isArray(fieldMeta)
        ? fieldMeta.map((f: any) => {
            const orgTable = f.orgTable ?? f.orgtable ?? "";
            const orgName = f.orgName ?? f.orgname ?? "";
            const db = f.schema ?? f.db ?? "";
            const source =
              orgTable && orgName
                ? { schema: db || "", table: orgTable, column: orgName }
                : null;
            return {
              name: f.name,
              dataTypeID: f.columnType ?? f.type ?? null,
              source,
            };
          })
        : undefined;
      return {
        rows: Array.isArray(rows) ? rows : [],
        executionTime,
        fields,
      };
    } finally {
      try {
        conn.release();
      } catch {
        // may already be released by timeout
      }
    }
  }

  async executeExplain(
    query: string,
    timeout: number = 30000
  ): Promise<{ plan: any; executionTime: number }> {
    const conn = await this.pool!.getConnection();
    const startTime = Date.now();

    try {
      const explainQuery = `EXPLAIN FORMAT=JSON ${query}`;
      const [rows] = await conn.query(explainQuery);
      const executionTime = Date.now() - startTime;
      const planJson = (rows as any[])[0]?.EXPLAIN;
      return {
        plan:
          typeof planJson === "string" ? JSON.parse(planJson) : planJson,
        executionTime,
      };
    } finally {
      conn.release();
    }
  }

  async query(sql: string, params: any[]): Promise<QueryResult> {
    const [rows] = await this.pool!.query(sql, params);

    // For INSERT/UPDATE/DELETE, mysql2 returns ResultSetHeader
    if (rows && typeof rows === "object" && "affectedRows" in rows) {
      const header = rows as any;
      return { rows: [], rowCount: header.affectedRows };
    }
    return {
      rows: rows as any[],
      rowCount: (rows as any[]).length,
    };
  }

  async getTableRowCounts(schema: string): Promise<Record<string, number>> {
    const [rows] = await this.pool!.query(
      `SELECT TABLE_NAME, TABLE_ROWS
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [schema]
    );
    const counts: Record<string, number> = {};
    for (const row of rows as any[]) {
      const n = Number(row.TABLE_ROWS ?? row.table_rows ?? 0);
      if (!isNaN(n)) counts[row.TABLE_NAME ?? row.table_name] = n;
    }
    return counts;
  }

  async runTransaction(
    statements: { sql: string; params: any[] }[]
  ): Promise<{ rowCounts: number[] }> {
    const conn = await this.pool!.getConnection();
    try {
      await conn.beginTransaction();
      const rowCounts: number[] = [];
      for (const stmt of statements) {
        const [result] = await conn.query(stmt.sql, stmt.params);
        if (result && typeof result === "object" && "affectedRows" in result) {
          rowCounts.push((result as any).affectedRows);
        } else {
          rowCounts.push(Array.isArray(result) ? result.length : 0);
        }
      }
      await conn.commit();
      return { rowCounts };
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // best effort
      }
      throw err;
    } finally {
      conn.release();
    }
  }

  // --- Health check ---

  getHealthInfo(): { totalCount: number; idleCount: number } {
    if (!this.pool) return { totalCount: 0, idleCount: 0 };
    // mysql2/promise wraps a core pool; access internal stats
    const rawPool = (this.pool as any).pool;
    const total = rawPool?._allConnections?.length ?? 0;
    const idle = rawPool?._freeConnections?.length ?? 0;
    return { totalCount: total, idleCount: idle };
  }

  async healthPing(): Promise<void> {
    const conn = await this.pool!.getConnection();
    try {
      await conn.query("SELECT 1");
    } finally {
      conn.release();
    }
  }
}
