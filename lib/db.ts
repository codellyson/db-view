import { Pool, PoolClient, PoolConfig } from "pg";
import { DBConfig } from "@/types";
import { getConnection, storeConnection } from "./connection-store";
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
    pool.end().catch(() => {});
  }
  pool = newPool;
  if (config) {
    poolConfig = config;
    console.log("Pool config stored:", {
      host: config.host,
      database: config.database,
      hasSSL: !!config.ssl,
    });
  }
  if (!newPool) {
    poolConfig = null;
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
        const configJson = Buffer.from(configCookie, "base64").toString(
          "utf-8"
        );
        configFromCookie = JSON.parse(configJson) as DBConfig;
        console.log("Retrieved config from cookie");
      } catch (parseError) {
        console.error("Failed to parse config from cookie:", parseError);
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

export async function getTables(): Promise<string[]> {
  const activePool = await ensurePool();

  let client;
  try {
    client = await activePool.connect();
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
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
  offset: number = 0
): Promise<{ rows: any[]; total: number }> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  const activePool = await ensurePool();
  const client = await activePool.connect();
  try {
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM ${client.escapeIdentifier(tableName)}`
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await client.query(
      `SELECT * FROM ${client.escapeIdentifier(tableName)} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      rows: dataResult.rows,
      total,
    };
  } finally {
    client.release();
  }
}

export async function getTableSchema(tableName: string): Promise<any[]> {
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
          AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.column_name = pk.column_name
      WHERE c.table_name = $1
      ORDER BY c.ordinal_position;
    `,
      [tableName]
    );

    return result.rows;
  } finally {
    client.release();
  }
}

export async function executeQuery(
  query: string
): Promise<{ rows: any[]; executionTime: number }> {
  const activePool = await ensurePool();
  const client = await activePool.connect();
  const startTime = Date.now();
  try {
    const result = await client.query(query);
    const executionTime = Date.now() - startTime;
    return {
      rows: result.rows,
      executionTime,
    };
  } finally {
    client.release();
  }
}
