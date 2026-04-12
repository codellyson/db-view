import { DBConfig } from "@/types";
import { DatabaseProvider, DatabaseType } from "./db-provider";
import { PostgreSQLProvider } from "./providers/postgresql";
import { SQLiteProvider } from "./providers/sqlite";
import { getConnection, storeConnection } from "./connection-store";
import { decrypt } from "./security";
import { cookies } from "next/headers";

// ─── Session-scoped pool registry ────────────────────────────────
// Each session gets its own DatabaseProvider so concurrent users
// never share a pool or leak data across connections.

interface SessionEntry {
  provider: DatabaseProvider;
  config: DBConfig;
  lastAccess: number;
}

const MAX_POOLS = parseInt(process.env.DBVIEW_MAX_POOLS || "50", 10);
const POOL_IDLE_MS = parseInt(process.env.DBVIEW_POOL_IDLE_MS || String(30 * 60 * 1000), 10); // 30 min

// Survive Next.js hot reloads in development.
const globalForDb = globalThis as unknown as {
  __dbSessions?: Map<string, SessionEntry>;
  __dbCleanupTimer?: ReturnType<typeof setInterval> | null;
};

if (!globalForDb.__dbSessions) {
  globalForDb.__dbSessions = new Map();
}

const sessions = globalForDb.__dbSessions;

// Periodic cleanup of idle pools.
if (!globalForDb.__dbCleanupTimer) {
  globalForDb.__dbCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [sid, entry] of sessions) {
      if (now - entry.lastAccess > POOL_IDLE_MS) {
        entry.provider.endPool().catch(() => {});
        sessions.delete(sid);
      }
    }
  }, 60_000);
  if (typeof globalForDb.__dbCleanupTimer === "object" && "unref" in globalForDb.__dbCleanupTimer) {
    globalForDb.__dbCleanupTimer.unref();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function createProvider(type: DatabaseType): DatabaseProvider {
  if (type === "mysql") {
    const { MySQLProvider } = require("./providers/mysql");
    return new MySQLProvider();
  }
  if (type === "sqlite") {
    return new SQLiteProvider();
  }
  return new PostgreSQLProvider();
}

// Evict the least-recently-used session if we're at the cap.
function evictIfNeeded() {
  if (sessions.size < MAX_POOLS) return;
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const [sid, entry] of sessions) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldest = sid;
    }
  }
  if (oldest) {
    const entry = sessions.get(oldest);
    entry?.provider.endPool().catch(() => {});
    sessions.delete(oldest);
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Create a pool for a specific session. Cleans up any previous pool
 * for that session first.
 */
export function createPool(config: DBConfig, type?: DatabaseType, sessionId?: string): void {
  const dbType = type || config.type || "postgresql";
  const sid = sessionId || "__default__";

  // Clean up existing pool for this session
  const existing = sessions.get(sid);
  if (existing) {
    existing.provider.endPool().catch(() => {});
    sessions.delete(sid);
  }

  evictIfNeeded();

  const provider = createProvider(dbType);
  provider.createPool(config);
  sessions.set(sid, { provider, config, lastAccess: Date.now() });
}

/**
 * Test a connection without creating a persistent pool.
 */
export async function testConnection(
  config: DBConfig,
  type?: DatabaseType
): Promise<boolean> {
  const dbType = type || config.type || "postgresql";
  const provider = createProvider(dbType);
  return provider.testConnection(config);
}

/**
 * Disconnect and remove the pool for a specific session.
 */
export async function disconnectSession(sessionId: string): Promise<void> {
  const entry = sessions.get(sessionId);
  if (entry) {
    await entry.provider.endPool().catch(() => {});
    sessions.delete(sessionId);
  }
}

/**
 * Get the pool for a specific session (null if none exists).
 */
export function getPoolForSession(sessionId: string): any | null {
  const entry = sessions.get(sessionId);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.provider.getPool();
  }
  return null;
}

/**
 * Get the provider for a specific session (null if none exists).
 */
export function getProviderForSession(sessionId: string): DatabaseProvider | null {
  const entry = sessions.get(sessionId);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.provider;
  }
  return null;
}

/**
 * Get the database type for a specific session.
 */
export function getDatabaseTypeForSession(sessionId: string): DatabaseType {
  return sessions.get(sessionId)?.provider.type ?? "postgresql";
}

/**
 * Ensure a pool exists for the given session. Tries (in order):
 *  1. Existing live pool in sessions map
 *  2. Config in the connection store (server-side session store)
 *  3. Encrypted config cookie
 * Returns the provider.
 */
export async function ensurePool(sessionId?: string): Promise<DatabaseProvider> {
  // 1. Already in the sessions map?
  if (sessionId) {
    const entry = sessions.get(sessionId);
    if (entry && entry.provider.getPool()) {
      entry.lastAccess = Date.now();
      return entry.provider;
    }

    // 2. Rebuild from session store
    const storedConfig = getConnection(sessionId);
    if (storedConfig) {
      createPool(storedConfig, storedConfig.type || "postgresql", sessionId);
      return sessions.get(sessionId)!.provider;
    }
  }

  // 3. Try cookies
  try {
    const cookieStore = await cookies();
    const cookieSessionId = cookieStore.get("db-session")?.value;
    const configCookie = cookieStore.get("db-config")?.value;

    if (cookieSessionId) {
      // Check sessions map with cookie session id
      const entry = sessions.get(cookieSessionId);
      if (entry && entry.provider.getPool()) {
        entry.lastAccess = Date.now();
        return entry.provider;
      }

      // Try session store with cookie session id
      const config = getConnection(cookieSessionId);
      if (config) {
        createPool(config, config.type || "postgresql", cookieSessionId);
        return sessions.get(cookieSessionId)!.provider;
      }

      // Try decrypting the config cookie
      if (configCookie) {
        try {
          const configJson = decrypt(configCookie);
          const config = JSON.parse(configJson) as DBConfig;
          storeConnection(cookieSessionId, config);
          createPool(config, config.type || "postgresql", cookieSessionId);
          return sessions.get(cookieSessionId)!.provider;
        } catch {
          // Cookie decryption failed
        }
      }
    }
  } catch {
    // Cookie access may fail in some contexts
  }

  throw new Error(
    sessionId
      ? "Database connection was lost (server may have restarted). Please reconnect to your database."
      : "No database connection. Please connect to a database first."
  );
}

/**
 * Convenience: read the session from cookies and return the provider.
 * Use this from API routes that don't already have the sessionId.
 */
export async function getSessionProvider(): Promise<{ provider: DatabaseProvider; sessionId: string }> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("db-session")?.value;
  if (!sessionId) {
    throw new Error("No database connection. Please connect to a database first.");
  }
  const provider = await ensurePool(sessionId);
  return { provider, sessionId };
}

// ─── Legacy shims ────────────────────────────────────────────────
// These are used by routes that haven't been migrated yet.
// They read session from cookies internally.

export function getPool(): any | null {
  // Can't read cookies synchronously in all contexts.
  // Routes that need pool checks should use getSessionProvider() instead.
  // This returns the first live pool for backward compat only.
  for (const entry of sessions.values()) {
    const pool = entry.provider.getPool();
    if (pool) return pool;
  }
  return null;
}

export function getProvider(): DatabaseProvider | null {
  for (const entry of sessions.values()) {
    if (entry.provider.getPool()) return entry.provider;
  }
  return null;
}

export function getDatabaseType(): DatabaseType {
  for (const entry of sessions.values()) {
    if (entry.provider.getPool()) return entry.provider.type;
  }
  return "postgresql";
}

// ─── Delegate functions ──────────────────────────────────────────
// These read the session from cookies automatically.

export async function getSchemas(): Promise<string[]> {
  const { provider } = await getSessionProvider();
  return provider.getSchemas();
}

export async function getTables(schema: string = "public"): Promise<string[]> {
  const { provider } = await getSessionProvider();
  return provider.getTables(schema);
}

export async function getTableData(
  tableName: string,
  limit: number = 100,
  offset: number = 0,
  sortColumn?: string,
  sortDirection?: "asc" | "desc",
  schema: string = "public"
): Promise<{ rows: any[]; total: number; countIsEstimate?: boolean }> {
  const { provider } = await getSessionProvider();
  return provider.getTableData(tableName, limit, offset, sortColumn, sortDirection, schema);
}

export async function getTableSchema(
  tableName: string,
  schema: string = "public"
): Promise<any[]> {
  const { provider } = await getSessionProvider();
  return provider.getTableSchema(tableName, schema);
}

export async function getTableRelationships(
  tableName: string,
  schema: string = "public"
): Promise<any[]> {
  const { provider } = await getSessionProvider();
  return provider.getTableRelationships(tableName, schema);
}

export async function getTableIndexes(
  tableName: string,
  schema: string = "public"
): Promise<any[]> {
  const { provider } = await getSessionProvider();
  return provider.getTableIndexes(tableName, schema);
}

export async function getViews(schema: string = "public"): Promise<string[]> {
  const { provider } = await getSessionProvider();
  return provider.getViews(schema);
}

export async function getMaterializedViews(
  schema: string = "public"
): Promise<string[]> {
  const { provider } = await getSessionProvider();
  return provider.getMaterializedViews(schema);
}

export async function getFunctions(
  schema: string = "public"
): Promise<any[]> {
  const { provider } = await getSessionProvider();
  return provider.getFunctions(schema);
}

export async function getTableStats(
  tableName: string,
  schema: string = "public"
): Promise<any> {
  const { provider } = await getSessionProvider();
  return provider.getTableStats(tableName, schema);
}

export async function executeQuery(
  query: string,
  timeout: number = 30000
) {
  const { provider } = await getSessionProvider();
  return provider.executeQuery(query, timeout);
}

export async function executeExplain(
  query: string,
  timeout: number = 30000
): Promise<{ plan: any; executionTime: number }> {
  const { provider } = await getSessionProvider();
  return provider.executeExplain(query, timeout);
}
