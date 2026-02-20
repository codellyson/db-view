import { Pool, PoolClient, PoolConfig } from "pg";
import { DBConfig } from "@/types";
import { getConnection, storeConnection } from "./connection-store";
import { decrypt } from "./security";
import { startHealthCheck, stopHealthCheck, resetHealthStatus } from "./health-check";
import { cookies } from "next/headers";

let pool: Pool | null = null;
let poolConfig: DBConfig | null = null;

export function createPool(config: DBConfig): Pool {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    max: 20,
    // idleTimeoutMillis: 30000,
    // connectionTimeoutMillis: 2000,
  };

  if (config.ssl !== undefined) {
    if (config.ssl === true) {
      poolConfig.ssl = { rejectUnauthorized: false };
    } else if (typeof config.ssl === "object") {
      poolConfig.ssl = config.ssl;
    }
  }

  return new Pool(poolConfig);
}

export async function testConnection(config: DBConfig): Promise<boolean> {
  const testConfig: DBConfig = {
    ...config,
    ssl: config.ssl !== undefined ? config.ssl : { rejectUnauthorized: false },
  };
  const testPool = createPool(testConfig);
  try {
    const client = await testPool.connect();
    await client.query("SELECT NOW()");
    client.release();
    await testPool.end();
    return true;
  } catch (error) {
    console.error("Test connection failed:", error);
    await testPool.end().catch(() => {});
    return false;
  }
}

export function getPool(): Pool | null {
  return pool;
}

export function setPool(newPool: Pool | null, config?: DBConfig): void {
  if (pool) {
    stopHealthCheck();
    pool.end().catch(() => {});
  }
  pool = newPool;
  if (config) {
    poolConfig = config;
    console.log("Pool config stored:", {
      host: config.host,
      database: config.database,
      hasSSL: !!config.ssl,
      port: config.port,
    });
  }
  if (newPool) {
    startHealthCheck(newPool);
  } else {
    poolConfig = null;
    resetHealthStatus();
    console.log("Pool cleared");
  }
}

export async function ensurePool(sessionId?: string): Promise<Pool> {
  if (pool) {
    return pool;
  }
  if (poolConfig) {
    console.log("Recreating pool from stored config");
    pool = createPool(poolConfig);
    return pool;
  }

  if (sessionId) {
    const config = getConnection(sessionId);
    if (config) {
      console.log("Recreating pool from session config");
      poolConfig = config;
      pool = createPool(config);
      return pool;
    }
  }

  let cookieSessionId: string | undefined;
  let configFromCookie: DBConfig | null = null;
  try {
    const cookieStore = await cookies();
    cookieSessionId = cookieStore.get("db-session")?.value;
    const configCookie = cookieStore.get("db-config")?.value;

    if (configCookie) {
      try {
        const configJson = decrypt(configCookie);
        configFromCookie = JSON.parse(configJson) as DBConfig;
        console.log("Retrieved config from cookie");
      } catch (parseError) {
        console.error("Failed to decrypt config from cookie:", parseError);
      }
    }

    if (cookieSessionId) {
      const config = getConnection(cookieSessionId);
      if (config) {
        console.log("Recreating pool from cookie session config");
        poolConfig = config;
        pool = createPool(config);
        return pool;
      } else if (configFromCookie) {
        console.log("Recreating pool from cookie config (server restarted)");
        poolConfig = configFromCookie;
        pool = createPool(configFromCookie);
        storeConnection(cookieSessionId, configFromCookie);
        return pool;
      } else {
        console.warn(
          "Session ID found in cookie but no config in connection store or cookie. Server may have restarted."
        );
      }
    }
  } catch (error) {
    console.error("Error getting cookies:", error);
  }

  console.error("Pool state:", {
    pool: pool ? "exists" : "null",
    poolConfig: poolConfig ? "exists" : "null",
    sessionId,
    cookieSessionId,
  });

  const errorMessage =
    sessionId || cookieSessionId
      ? "Database connection was lost (server may have restarted). Please reconnect to your database."
      : "No database connection. Please connect to a database first.";

  throw new Error(errorMessage);
}

export async function getSchemas(): Promise<string[]> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
  try {
    const result = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name;
    `);
    return result.rows.map((row) => row.schema_name);
  } catch (error: any) {
    console.error("Error in getSchemas:", error);
    throw new Error(`Failed to fetch schemas: ${error.message}`);
  } finally {
    client.release();
  }
}

export async function getTables(schema: string = "public"): Promise<string[]> {
  const activePool = await ensurePool();

  let client;
  try {
    client = await activePool.connect();
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `, [schema]);
    return result.rows.map((row) => row.table_name);
  } catch (error: any) {
    console.error("Error in getTables:", error);
    throw new Error(`Failed to fetch tables: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function getTableData(
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

  const activePool = await ensurePool();
  const client = await activePool.connect();
  try {
    const qualifiedTable = `${client.escapeIdentifier(schema)}.${client.escapeIdentifier(tableName)}`;

    // Try estimated count first from pg_class
    let total: number;
    let countIsEstimate = false;

    const estimateResult = await client.query(
      `SELECT reltuples::bigint AS estimate FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND n.nspname = $2`,
      [tableName, schema]
    );
    const estimate = parseInt(estimateResult.rows[0]?.estimate || "0", 10);

    if (estimate > 10000) {
      // Use estimate for large tables to avoid full scan
      total = estimate;
      countIsEstimate = true;
    } else {
      // Exact count for smaller tables
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

    return {
      rows: dataResult.rows,
      total,
      countIsEstimate,
    };
  } finally {
    client.release();
  }
}

export async function getTableSchema(tableName: string, schema: string = "public"): Promise<any[]> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  const activePool = await ensurePool();
  const client = await activePool.connect();
  try {
    const result = await client.query(
      `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
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

export async function getTableRelationships(tableName: string, schema: string = "public"): Promise<any[]> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
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

export async function getTableIndexes(tableName: string, schema: string = "public"): Promise<any[]> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
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

export async function getViews(schema: string = "public"): Promise<string[]> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
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
    return result.rows.map((row) => row.table_name);
  } finally {
    client.release();
  }
}

export async function getMaterializedViews(schema: string = "public"): Promise<string[]> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
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
    return result.rows.map((row) => row.name);
  } finally {
    client.release();
  }
}

export async function getFunctions(schema: string = "public"): Promise<any[]> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
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

async function cancelBackendQuery(pool: Pool, pid: number): Promise<void> {
  let cancelClient;
  try {
    cancelClient = await pool.connect();
    await cancelClient.query("SELECT pg_cancel_backend($1)", [pid]);
  } catch {
    // Best effort cancellation
  } finally {
    cancelClient?.release();
  }
}

async function executeWithTimeout<T>(
  pool: Pool,
  client: PoolClient,
  queryFn: () => Promise<T>,
  timeout: number
): Promise<T> {
  // Get the backend PID for this connection
  const pidResult = await client.query("SELECT pg_backend_pid() AS pid");
  const pid = pidResult.rows[0].pid;

  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(async () => {
      await cancelBackendQuery(pool, pid);
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

export async function executeExplain(
  query: string,
  timeout: number = 30000
): Promise<{ plan: any; executionTime: number }> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
  const startTime = Date.now();

  try {
    const explainQuery = `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`;
    const result = await executeWithTimeout(
      activePool,
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

export async function executeQuery(
  query: string,
  timeout: number = 30000
): Promise<{ rows: any[]; executionTime: number }> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
  const startTime = Date.now();

  try {
    const result = await executeWithTimeout(
      activePool,
      client,
      () => client.query(query),
      timeout
    );
    const executionTime = Date.now() - startTime;

    return {
      rows: result.rows,
      executionTime,
    };
  } finally {
    client.release();
  }
}
