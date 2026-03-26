import { DBConfig } from "@/types";
import { DatabaseProvider, DatabaseType } from "./db-provider";
import { PostgreSQLProvider } from "./providers/postgresql";
import { getConnection, storeConnection } from "./connection-store";
import { decrypt } from "./security";
import { startHealthCheck, stopHealthCheck, resetHealthStatus } from "./health-check";
import { cookies } from "next/headers";

// Persist across Next.js hot reloads in development.
// Without this, every file save wipes the connection pool.
const globalForDb = globalThis as unknown as {
  __dbActiveProvider?: DatabaseProvider | null;
  __dbPoolConfig?: DBConfig | null;
};

let activeProvider: DatabaseProvider | null = globalForDb.__dbActiveProvider ?? null;
let poolConfig: DBConfig | null = globalForDb.__dbPoolConfig ?? null;

function persistGlobals() {
  globalForDb.__dbActiveProvider = activeProvider;
  globalForDb.__dbPoolConfig = poolConfig;
}

function createProvider(type: DatabaseType): DatabaseProvider {
  if (type === "mysql") {
    // Dynamic import to avoid loading mysql2 when only using PostgreSQL
    const { MySQLProvider } = require("./providers/mysql");
    return new MySQLProvider();
  }
  return new PostgreSQLProvider();
}

export function getProvider(): DatabaseProvider | null {
  return activeProvider;
}

export function getDatabaseType(): DatabaseType {
  return activeProvider?.type ?? "postgresql";
}

export function createPool(config: DBConfig, type?: DatabaseType): void {
  const dbType = type || config.type || "postgresql";

  // Clean up existing provider if switching types or reconnecting
  if (activeProvider) {
    stopHealthCheck();
    activeProvider.endPool().catch(() => {});
  }

  activeProvider = createProvider(dbType);
  activeProvider.createPool(config);
  poolConfig = config;
  persistGlobals();
  startHealthCheck(activeProvider);
}

export async function testConnection(
  config: DBConfig,
  type?: DatabaseType
): Promise<boolean> {
  const dbType = type || config.type || "postgresql";
  const provider = createProvider(dbType);
  return provider.testConnection(config);
}

export function getPool(): any | null {
  return activeProvider?.getPool() ?? null;
}

export function setPool(
  newPool: any | null,
  config?: DBConfig
): void {
  if (activeProvider) {
    stopHealthCheck();
    activeProvider.endPool().catch(() => {});
  }

  if (newPool === null) {
    activeProvider = null;
    poolConfig = null;
    persistGlobals();
    resetHealthStatus();
    return;
  }

  if (config) {
    poolConfig = config;
  }
  persistGlobals();

  if (activeProvider) {
    startHealthCheck(activeProvider);
  }
}

export async function ensurePool(sessionId?: string): Promise<any> {
  if (activeProvider?.getPool()) {
    return activeProvider.getPool();
  }

  // Try to reconstruct from poolConfig (survives hot reload via globalThis)
  if (poolConfig) {
    const dbType = poolConfig.type || "postgresql";
    activeProvider = createProvider(dbType);
    activeProvider.createPool(poolConfig);
    persistGlobals();
    startHealthCheck(activeProvider);
    return activeProvider.getPool();
  }

  // Try session store
  if (sessionId) {
    const config = getConnection(sessionId);
    if (config) {
      poolConfig = config;
      const dbType = config.type || "postgresql";
      activeProvider = createProvider(dbType);
      activeProvider.createPool(config);
      persistGlobals();
      startHealthCheck(activeProvider);
      return activeProvider.getPool();
    }
  }

  // Try cookies
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
      } catch {
        // Cookie decryption failed
      }
    }

    if (cookieSessionId) {
      const config = getConnection(cookieSessionId);
      if (config) {
        poolConfig = config;
        const dbType = config.type || "postgresql";
        activeProvider = createProvider(dbType);
        activeProvider.createPool(config);
        persistGlobals();
        startHealthCheck(activeProvider);
        return activeProvider.getPool();
      } else if (configFromCookie) {
        poolConfig = configFromCookie;
        const dbType = configFromCookie.type || "postgresql";
        activeProvider = createProvider(dbType);
        activeProvider.createPool(configFromCookie);
        storeConnection(cookieSessionId, configFromCookie);
        persistGlobals();
        startHealthCheck(activeProvider);
        return activeProvider.getPool();
      }
    }
  } catch {
    // Cookie access may fail in some contexts
  }

  const errorMessage =
    sessionId || cookieSessionId
      ? "Database connection was lost (server may have restarted). Please reconnect to your database."
      : "No database connection. Please connect to a database first.";

  throw new Error(errorMessage);
}

// --- Delegating functions (same signatures as before) ---

async function getActiveProvider(): Promise<DatabaseProvider> {
  if (!activeProvider?.getPool()) {
    await ensurePool();
  }
  return activeProvider!;
}

export async function getSchemas(): Promise<string[]> {
  return (await getActiveProvider()).getSchemas();
}

export async function getTables(schema: string = "public"): Promise<string[]> {
  return (await getActiveProvider()).getTables(schema);
}

export async function getTableData(
  tableName: string,
  limit: number = 100,
  offset: number = 0,
  sortColumn?: string,
  sortDirection?: "asc" | "desc",
  schema: string = "public"
): Promise<{ rows: any[]; total: number; countIsEstimate?: boolean }> {
  return (await getActiveProvider()).getTableData(
    tableName, limit, offset, sortColumn, sortDirection, schema
  );
}

export async function getTableSchema(
  tableName: string,
  schema: string = "public"
): Promise<any[]> {
  return (await getActiveProvider()).getTableSchema(tableName, schema);
}

export async function getTableRelationships(
  tableName: string,
  schema: string = "public"
): Promise<any[]> {
  return (await getActiveProvider()).getTableRelationships(tableName, schema);
}

export async function getTableIndexes(
  tableName: string,
  schema: string = "public"
): Promise<any[]> {
  return (await getActiveProvider()).getTableIndexes(tableName, schema);
}

export async function getViews(schema: string = "public"): Promise<string[]> {
  return (await getActiveProvider()).getViews(schema);
}

export async function getMaterializedViews(
  schema: string = "public"
): Promise<string[]> {
  return (await getActiveProvider()).getMaterializedViews(schema);
}

export async function getFunctions(
  schema: string = "public"
): Promise<any[]> {
  return (await getActiveProvider()).getFunctions(schema);
}

export async function getTableStats(
  tableName: string,
  schema: string = "public"
): Promise<any> {
  return (await getActiveProvider()).getTableStats(tableName, schema);
}

export async function executeQuery(
  query: string,
  timeout: number = 30000
): Promise<{ rows: any[]; executionTime: number }> {
  return (await getActiveProvider()).executeQuery(query, timeout);
}

export async function executeExplain(
  query: string,
  timeout: number = 30000
): Promise<{ plan: any; executionTime: number }> {
  return (await getActiveProvider()).executeExplain(query, timeout);
}
