import { Pool, PoolClient, PoolConfig } from "pg";
import { DBConfig } from "@/types";
import { DatabaseProvider, ExecuteQueryResult, QueryFieldInfo, QueryResult } from "../db-provider";

export class PostgreSQLProvider implements DatabaseProvider {
  readonly type = "postgresql" as const;
  private pool: Pool | null = null;
  // Cache: table OID -> { schema, table }. Cleared on endPool().
  private oidCache = new Map<number, { schema: string; table: string }>();
  // Cache: "tableOID:attNum" -> column name. Cleared on endPool().
  private columnCache = new Map<string, string>();

  createPool(config: DBConfig): void {
    const poolOpts: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    };

    if (config.ssl === true) {
      poolOpts.ssl = { rejectUnauthorized: false };
    } else if (typeof config.ssl === "object") {
      poolOpts.ssl = config.ssl;
    }

    this.pool = new Pool(poolOpts);
  }

  async testConnection(config: DBConfig): Promise<boolean> {
    const provider = new PostgreSQLProvider();
    provider.createPool(config);
    try {
      const client = await provider.pool!.connect();
      await client.query("SELECT NOW()");
      client.release();
      await provider.pool!.end();
      return true;
    } catch (err: any) {
      console.error("PostgreSQL testConnection error:", err?.message || err);
      await provider.pool?.end().catch(() => {});
      throw err;
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
    this.oidCache.clear();
    this.columnCache.clear();
  }

  private async resolveFieldSources(
    client: PoolClient,
    pgFields: any[]
  ): Promise<QueryFieldInfo[]> {
    // Collect OIDs we haven't seen and column pairs we haven't resolved.
    const unknownTableIds = new Set<number>();
    const unknownColumns: { tableID: number; columnID: number }[] = [];
    for (const f of pgFields) {
      if (f.tableID && f.tableID > 0) {
        if (!this.oidCache.has(f.tableID)) unknownTableIds.add(f.tableID);
        if (f.columnID && f.columnID > 0) {
          const key = `${f.tableID}:${f.columnID}`;
          if (!this.columnCache.has(key)) {
            unknownColumns.push({ tableID: f.tableID, columnID: f.columnID });
          }
        }
      }
    }

    if (unknownTableIds.size > 0) {
      const ids = Array.from(unknownTableIds);
      const res = await client.query(
        `SELECT c.oid::int AS oid, n.nspname AS schema, c.relname AS table
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.oid = ANY($1::oid[])`,
        [ids]
      );
      for (const row of res.rows) {
        this.oidCache.set(row.oid, { schema: row.schema, table: row.table });
      }
    }

    if (unknownColumns.length > 0) {
      // Build (tableID, columnID) pairs and query pg_attribute in one round-trip.
      const tableIds = unknownColumns.map((c) => c.tableID);
      const colIds = unknownColumns.map((c) => c.columnID);
      const res = await client.query(
        `SELECT a.attrelid::int AS table_id, a.attnum::int AS col_id, a.attname AS name
         FROM pg_attribute a
         WHERE (a.attrelid, a.attnum) IN (
           SELECT unnest($1::oid[]), unnest($2::int[])
         )`,
        [tableIds, colIds]
      );
      for (const row of res.rows) {
        this.columnCache.set(`${row.table_id}:${row.col_id}`, row.name);
      }
    }

    return pgFields.map((f: any) => {
      const base: QueryFieldInfo = {
        name: f.name,
        dataTypeID: f.dataTypeID ?? null,
        source: null,
      };
      if (!f.tableID || f.tableID <= 0) return base;
      const tbl = this.oidCache.get(f.tableID);
      if (!tbl) return base;
      if (!f.columnID || f.columnID <= 0) {
        // Column came from a base table but this specific output slot is computed
        // (e.g. a function over a base column). Leave source null.
        return base;
      }
      const column = this.columnCache.get(`${f.tableID}:${f.columnID}`);
      if (!column) return base;
      return {
        ...base,
        source: { schema: tbl.schema, table: tbl.table, column },
      };
    });
  }

  // --- Schema introspection ---

  async getSchemas(): Promise<string[]> {
    const client = await this.connect();
    try {
      const result = await client.query(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name;
      `);
      return result.rows.map((row: any) => row.schema_name);
    } catch (error: any) {
      throw new Error(`Failed to fetch schemas: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async getTables(schema: string): Promise<string[]> {
    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `,
        [schema]
      );
      return result.rows.map((row: any) => row.table_name);
    } catch (error: any) {
      throw new Error(`Failed to fetch tables: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async getViews(schema: string): Promise<string[]> {
    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = $1
        ORDER BY table_name;
      `,
        [schema]
      );
      return result.rows.map((row: any) => row.table_name);
    } finally {
      client.release();
    }
  }

  async getMaterializedViews(schema: string): Promise<string[]> {
    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT matviewname AS name
        FROM pg_matviews
        WHERE schemaname = $1
        ORDER BY matviewname;
      `,
        [schema]
      );
      return result.rows.map((row: any) => row.name);
    } finally {
      client.release();
    }
  }

  async getFunctions(schema: string): Promise<any[]> {
    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT
          p.proname AS name,
          pg_get_function_arguments(p.oid) AS arguments,
          t.typname AS return_type,
          l.lanname AS language,
          CASE p.prokind
            WHEN 'f' THEN 'function'
            WHEN 'p' THEN 'procedure'
            WHEN 'a' THEN 'aggregate'
            WHEN 'w' THEN 'window'
          END AS kind
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        JOIN pg_type t ON p.prorettype = t.oid
        JOIN pg_language l ON p.prolang = l.oid
        WHERE n.nspname = $1
          AND p.prokind IN ('f', 'p')
        ORDER BY p.proname;
      `,
        [schema]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getTableSchema(
    tableName: string,
    schema: string
  ): Promise<any[]> {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }

    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE
            WHEN pk.column_name IS NOT NULL THEN true
            ELSE false
          END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_name = $1
            AND tc.table_schema = $2
            AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = $1
          AND c.table_schema = $2
        ORDER BY c.ordinal_position;
      `,
        [tableName, schema]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getTableRelationships(
    tableName: string,
    schema: string
  ): Promise<any[]> {
    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT
          tc.constraint_name,
          kcu.column_name AS source_column,
          ccu.table_schema AS target_schema,
          ccu.table_name AS target_table,
          ccu.column_name AS target_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND tc.table_schema = $2
        ORDER BY tc.constraint_name;
      `,
        [tableName, schema]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getTableData(
    tableName: string,
    limit: number = 100,
    offset: number = 0,
    sortColumn?: string,
    sortDirection?: "asc" | "desc",
    schema: string = "public"
  ): Promise<{ rows: any[]; total: number; countIsEstimate?: boolean }> {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      throw new Error("Invalid schema name");
    }

    const client = await this.connect();
    try {
      const qualifiedTable = `${client.escapeIdentifier(schema)}.${client.escapeIdentifier(tableName)}`;

      let total: number;
      let countIsEstimate = false;

      const estimateResult = await client.query(
        `SELECT reltuples::bigint AS estimate FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND n.nspname = $2`,
        [tableName, schema]
      );
      const estimate = parseInt(
        estimateResult.rows[0]?.estimate || "0",
        10
      );

      if (estimate > 10000) {
        total = estimate;
        countIsEstimate = true;
      } else {
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM ${qualifiedTable}`
        );
        total = parseInt(countResult.rows[0].count, 10);
      }

      let query = `SELECT * FROM ${qualifiedTable}`;

      if (sortColumn && sortDirection) {
        const colCheck = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
          [schema, tableName, sortColumn]
        );
        if (colCheck.rows.length > 0) {
          query += ` ORDER BY ${client.escapeIdentifier(sortColumn)} ${sortDirection === "desc" ? "DESC" : "ASC"}`;
        }
      }

      query += ` LIMIT $1 OFFSET $2`;
      const dataResult = await client.query(query, [limit, offset]);

      return { rows: dataResult.rows, total, countIsEstimate };
    } finally {
      client.release();
    }
  }

  async getTableIndexes(
    tableName: string,
    schema: string
  ): Promise<any[]> {
    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT
          i.relname AS index_name,
          am.amname AS index_type,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary,
          array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1
          AND n.nspname = $2
        GROUP BY i.relname, am.amname, ix.indisunique, ix.indisprimary
        ORDER BY i.relname;
      `,
        [tableName, schema]
      );
      return result.rows;
    } finally {
      client.release();
    }
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

    const client = await this.connect();
    try {
      const result = await client.query(
        `
        SELECT
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
          pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
          pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
          c.reltuples::bigint AS estimated_rows,
          s.seq_scan,
          s.idx_scan,
          s.n_live_tup AS live_rows,
          s.n_dead_tup AS dead_rows,
          s.last_vacuum,
          s.last_autovacuum,
          s.last_analyze,
          s.last_autoanalyze
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE c.relname = $1 AND n.nspname = $2
      `,
        [tableName, schema]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  // --- Query execution ---

  async executeQuery(
    query: string,
    timeout: number = 30000
  ): Promise<ExecuteQueryResult> {
    const client = await this.connect();
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        client,
        () => client.query(query),
        timeout
      );
      const executionTime = Date.now() - startTime;
      const fields = result.fields
        ? await this.resolveFieldSources(client, result.fields as any[])
        : undefined;
      return { rows: result.rows, executionTime, fields };
    } finally {
      client.release();
    }
  }

  async executeExplain(
    query: string,
    timeout: number = 30000
  ): Promise<{ plan: any; executionTime: number }> {
    const client = await this.connect();
    const startTime = Date.now();

    try {
      const explainQuery = `EXPLAIN (FORMAT JSON) ${query}`;
      const result = await this.executeWithTimeout(
        client,
        () => client.query(explainQuery),
        timeout
      );
      const executionTime = Date.now() - startTime;
      return {
        plan: result.rows[0]["QUERY PLAN"],
        executionTime,
      };
    } finally {
      client.release();
    }
  }

  async query(sql: string, params: any[]): Promise<QueryResult> {
    const client = await this.connect();
    try {
      const result = await client.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? undefined,
      };
    } finally {
      client.release();
    }
  }

  // --- Health check ---

  getHealthInfo(): { totalCount: number; idleCount: number } {
    if (!this.pool) return { totalCount: 0, idleCount: 0 };
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
    };
  }

  async healthPing(): Promise<void> {
    const client = await this.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
  }

  // --- Private helpers ---

  private async connect(): Promise<PoolClient> {
    if (!this.pool) throw new Error("Pool not initialized");
    return this.pool.connect();
  }

  private async cancelBackendQuery(pid: number): Promise<void> {
    if (!this.pool) return;
    let cancelClient: PoolClient | undefined;
    try {
      cancelClient = await this.pool.connect();
      await cancelClient.query("SELECT pg_cancel_backend($1)", [pid]);
    } catch {
      // Best effort cancellation
    } finally {
      cancelClient?.release();
    }
  }

  private async executeWithTimeout<T>(
    client: PoolClient,
    queryFn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    const pidResult = await client.query("SELECT pg_backend_pid() AS pid");
    const pid = pidResult.rows[0].pid;

    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(async () => {
        await this.cancelBackendQuery(pid);
        client.release();
        reject(new Error("Query timeout exceeded"));
      }, timeout);
    });

    try {
      const result = await Promise.race([queryFn(), timeoutPromise]);
      clearTimeout(timer!);
      return result;
    } catch (error) {
      clearTimeout(timer!);
      throw error;
    }
  }
}
