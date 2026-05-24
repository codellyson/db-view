/**
 * Tauri dispatcher for lib/api.ts.
 *
 * In the desktop build there is no server — `api.get('/api/tables')` has to
 * land on a Rust command via Tauri's `invoke`. This module owns that
 * translation so callers keep using `api.*` unchanged.
 *
 * Phase 1 scope (docs/tauri-migration.md):
 *   - POST /api/connect       → db_connect
 *   - POST /api/disconnect    → db_disconnect
 *   - GET  /api/health        → db_health
 *   - GET  /api/schemas       → db_list_schemas
 *   - GET  /api/tables        → db_list_tables
 *   - GET  /api/table/[name]  → db_table_rows
 *
 * Later phases extend the dispatcher with more commands as the Rust side
 * grows. Unhandled routes throw, on purpose — silent fallbacks would hide
 * the actual migration work surface.
 */

import type { InvokeArgs } from "@tauri-apps/api/core";
import { classifyQuery, requiresTypedConfirmation } from "./query-classifier";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type InvokeFn = <T>(cmd: string, args?: InvokeArgs) => Promise<T>;

// Session state mirrors the `db-session` cookie the SaaS uses. Module memory
// is correct here: the Rust DashMap dies with the process, so a webview
// reload dropping the session matches reality.
let sessionId: string | null = null;

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getSessionId(): string | null {
  return sessionId;
}

export async function dispatch<T>(
  method: HttpMethod,
  url: string,
  body?: unknown,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { path, params } = parseUrl(url);

  const handler = matchRoute(method, path);
  if (!handler) {
    throw new Error(
      `[api-tauri] No desktop handler for ${method} ${url}. Add it to lib/api-tauri.ts.`,
    );
  }
  return handler({ invoke, body, params }) as Promise<T>;
}

interface HandlerCtx {
  invoke: InvokeFn;
  body: unknown;
  params: URLSearchParams;
}

function matchRoute(
  method: HttpMethod,
  path: string,
): ((ctx: HandlerCtx) => Promise<unknown>) | null {
  // Static routes first. Resolved inside a function (not a top-level object
  // literal) because Turbopack transpiles `async function handler() {}` to
  // `const handler = async function() {}`, and a top-level table literal
  // evaluates before those bindings are initialized → ReferenceError.
  const staticHandler = matchStaticRoute(method, path);
  if (staticHandler) return staticHandler;

  // Parametric routes.
  if (method === "GET") {
    let m = path.match(/^\/api\/table\/([^/]+)$/);
    if (m) {
      const name = decodeURIComponent(m[1]);
      return (ctx) => handleTableRows({ ...ctx, pathParam: name });
    }
    m = path.match(/^\/api\/schema\/([^/]+)$/);
    if (m) {
      const name = decodeURIComponent(m[1]);
      return (ctx) => handleTableSchema({ ...ctx, pathParam: name });
    }
    m = path.match(/^\/api\/relationships\/([^/]+)$/);
    if (m) {
      const name = decodeURIComponent(m[1]);
      return (ctx) => handleRelationships({ ...ctx, pathParam: name });
    }
    m = path.match(/^\/api\/table-stats\/([^/]+)$/);
    if (m) {
      const name = decodeURIComponent(m[1]);
      return (ctx) => handleTableStats({ ...ctx, pathParam: name });
    }
  }

  // Stubbed routes — known-future endpoints the dashboard hits on mount.
  // Returning empty defaults keeps the UI quiet without faking data. Each
  // gets a real handler when its phase lands; the noteStub() log makes the
  // gap visible during development.
  const stub = matchStub(method, path);
  if (stub) return async () => stub();

  return null;
}

// Stubs for routes the dashboard fires that we'll wire in later phases.
// Phase pointers refer to docs/tauri-migration.md.
const STATIC_STUBS: Record<string, { phase: string; value: unknown }> = {};

interface StubMatch {
  key: string;
  phase: string;
  value: unknown;
}

function matchStub(method: HttpMethod, path: string): (() => unknown) | null {
  const key = `${method} ${path}`;
  const direct = STATIC_STUBS[key];
  if (direct) return () => returnStub({ key, phase: direct.phase, value: direct.value });

  if (method === "GET") {
    // /api/schema/<name>          → empty column list   (Phase 3)
    // /api/relationships/<name>   → no FKs              (Phase 3)
    // /api/table-stats/<name>     → null stats          (Phase 4)
  }
  return null;
}

const STUB_LOGGED = new Set<string>();
function returnStub(match: StubMatch): unknown {
  if (!STUB_LOGGED.has(match.key)) {
    STUB_LOGGED.add(match.key);
    console.info(`[api-tauri] stubbed ${match.key} (${match.phase})`);
  }
  return match.value;
}

function matchStaticRoute(
  method: HttpMethod,
  path: string,
): ((ctx: HandlerCtx) => Promise<unknown>) | null {
  // Each case returns an arrow that defers the handler-name lookup until
  // invocation. Direct `return handlerName;` triggers the lookup at
  // case-match time, which can hit a TDZ during HMR transitions because
  // Turbopack transpiles `async function h() {}` into `const h = async …`.
  switch (`${method} ${path}`) {
    case "POST /api/connect":             return (ctx) => handleConnect(ctx);
    case "POST /api/disconnect":          return (ctx) => handleDisconnect(ctx);
    case "GET /api/health":               return (ctx) => handleHealth(ctx);
    case "GET /api/schemas":              return (ctx) => handleSchemas(ctx);
    case "GET /api/tables":               return (ctx) => handleTables(ctx);
    case "POST /api/mutate":              return (ctx) => handleMutate(ctx);
    case "POST /api/mutate-batch":        return (ctx) => handleMutateBatch(ctx);
    case "POST /api/lookup-row":          return (ctx) => handleLookupRow(ctx);
    case "POST /api/ddl":                 return (ctx) => handleDdl(ctx);
    case "GET /api/schema-map":           return (ctx) => handleSchemaMap(ctx);
    case "POST /api/cascade-preview":     return (ctx) => handleCascadePreview(ctx);
    case "GET /api/views":                return (ctx) => handleViews(ctx);
    case "GET /api/functions":            return (ctx) => handleFunctions(ctx);
    case "GET /api/table-counts":         return (ctx) => handleTableCounts(ctx);
    case "GET /api/saved-connections":    return (ctx) => handleSavedList(ctx);
    case "POST /api/saved-connections":   return (ctx) => handleSavedCreate(ctx);
    case "DELETE /api/saved-connections": return (ctx) => handleSavedDelete(ctx);
    case "PATCH /api/saved-connections":  return (ctx) => handleSavedConnect(ctx);
    case "POST /api/query":               return (ctx) => handleQuery(ctx);
    case "POST /api/explain":             return (ctx) => handleExplain(ctx);
    case "POST /api/import":              return (ctx) => handleImport(ctx);
    default: return null;
  }
}

async function handleConnect({ invoke, body }: HandlerCtx): Promise<unknown> {
  const config = extractConnectConfig(body);
  const res = await invoke<{ session_id: string; database: string }>(
    "db_connect",
    { config },
  );
  sessionId = res.session_id;
  // Shape-match app/api/connect/route.ts so connection-context doesn't care
  // it's talking to Tauri. saveName/saveId is a no-op until Phase 5 (OS keychain).
  return {
    success: true,
    database: res.database,
    type: config.type ?? "postgresql",
  };
}

async function handleDisconnect({ invoke }: HandlerCtx): Promise<unknown> {
  if (!sessionId) return { success: true };
  await invoke<void>("db_disconnect", { sessionId });
  sessionId = null;
  return { success: true };
}

async function handleHealth({ invoke }: HandlerCtx): Promise<unknown> {
  const sid = sessionId;
  if (!sid) {
    return { healthy: false, latency: null, activeConnections: 0, idleConnections: 0 };
  }
  // db_health never errors — it returns { healthy: false, ... } when something's off.
  return invoke("db_health", { sessionId: sid });
}

async function handleSchemas({ invoke }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  const schemas = await invoke<string[]>("db_list_schemas", { sessionId: sid });
  return { schemas };
}

async function handleTables({ invoke, params }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  const schema = params.get("schema") || "public";
  const tables = await invoke<string[]>("db_list_tables", { sessionId: sid, schema });
  return { tables };
}

async function handleTableSchema(
  ctx: HandlerCtx & { pathParam?: string },
): Promise<unknown> {
  const sid = requireSession();
  const { invoke, params, pathParam } = ctx;
  if (!pathParam) throw new Error("[api-tauri] /api/schema requires a table name");
  const schemaName = params.get("schema") || "public";
  const cols = await invoke<unknown[]>("db_table_schema", {
    sessionId: sid,
    table: pathParam,
    schema: schemaName,
  });
  return { schema: cols };
}

async function handleTableRows(
  ctx: HandlerCtx & { pathParam?: string },
): Promise<unknown> {
  const sid = requireSession();
  const { invoke, params, pathParam } = ctx;
  if (!pathParam) throw new Error("[api-tauri] /api/table requires a table name");

  const limit = clampInt(params.get("limit"), 100, 1, 1000);
  const offset = clampInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const schema = params.get("schema") || "public";
  const sortColumn = params.get("sortColumn") || undefined;
  const sortDirRaw = params.get("sortDirection");
  const sortDirection =
    sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : undefined;

  // `filters` is in scope for the web route but requires Phase 2 work to
  // translate to SQL-with-params on the Rust side. Surface explicitly rather
  // than silently dropping.
  if (params.get("filters")) {
    throw new Error(
      "[api-tauri] Column filters aren't supported on desktop yet (Phase 2).",
    );
  }

  return invoke("db_table_rows", {
    sessionId: sid,
    table: pathParam,
    schema,
    limit,
    offset,
    sortColumn,
    sortDirection,
  });
}

async function handleMutate({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] /api/mutate requires a body");
  }
  return invoke("db_mutate", { sessionId: sid, body });
}

async function handleMutateBatch({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] /api/mutate-batch requires a body");
  }
  const changes = (body as { changes?: unknown }).changes;
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error("[api-tauri] /api/mutate-batch requires a non-empty `changes` array");
  }
  return invoke("db_mutate_batch", { sessionId: sid, changes });
}

async function handleDdl({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] /api/ddl requires a body");
  }
  const { sql } = body as { sql?: unknown };
  if (typeof sql !== "string" || !sql) {
    throw new Error("[api-tauri] /api/ddl requires sql");
  }
  return invoke("db_ddl", { sessionId: sid, sql });
}

async function handleSchemaMap({ invoke, params }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  const schema = params.get("schema") || "public";
  return invoke("db_schema_map", { sessionId: sid, schema });
}

async function handleRelationships(
  ctx: HandlerCtx & { pathParam?: string },
): Promise<unknown> {
  const sid = requireSession();
  const { invoke, params, pathParam } = ctx;
  if (!pathParam) throw new Error("[api-tauri] /api/relationships requires a table name");
  const schema = params.get("schema") || "public";
  return invoke("db_relationships", { sessionId: sid, table: pathParam, schema });
}

async function handleViews({ invoke, params }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  const schema = params.get("schema") || "public";
  return invoke("db_views", { sessionId: sid, schema });
}

async function handleFunctions({ invoke, params }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  const schema = params.get("schema") || "public";
  return invoke("db_functions", { sessionId: sid, schema });
}

async function handleTableCounts({ invoke, params }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  const schema = params.get("schema") || "public";
  return invoke("db_table_counts", { sessionId: sid, schema });
}

async function handleTableStats(
  ctx: HandlerCtx & { pathParam?: string },
): Promise<unknown> {
  const sid = requireSession();
  const { invoke, params, pathParam } = ctx;
  if (!pathParam) throw new Error("[api-tauri] /api/table-stats requires a table name");
  const schema = params.get("schema") || "public";
  return invoke("db_table_stats", { sessionId: sid, table: pathParam, schema });
}

async function handleSavedList({ invoke }: HandlerCtx): Promise<unknown> {
  const connections = await invoke<unknown[]>("db_saved_list");
  return { connections };
}

async function handleSavedCreate({ invoke, body }: HandlerCtx): Promise<unknown> {
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] POST /api/saved-connections requires a body");
  }
  const { id, name, config } = body as {
    id?: string;
    name?: string;
    config?: unknown;
  };
  if (!id || !name || !config) {
    throw new Error("[api-tauri] id, name, and config are required");
  }
  const connection = await invoke("db_saved_create", { id, name, config });
  return { connection };
}

async function handleSavedDelete({ invoke, body }: HandlerCtx): Promise<unknown> {
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] DELETE /api/saved-connections requires a body");
  }
  const { id } = body as { id?: string };
  if (!id) throw new Error("[api-tauri] Connection id is required");
  await invoke("db_saved_delete", { id });
  return { success: true };
}

async function handleSavedConnect({ invoke, body }: HandlerCtx): Promise<unknown> {
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] PATCH /api/saved-connections requires a body");
  }
  const { id } = body as { id?: string };
  if (!id) throw new Error("[api-tauri] Connection id is required");
  const res = await invoke<{ session_id: string; database: string }>(
    "db_saved_connect",
    { id },
  );
  // Mirror handleConnect: stash the new session id for subsequent calls and
  // shape-match the SaaS PATCH response.
  sessionId = res.session_id;
  return {
    success: true,
    database: res.database,
    type: "postgresql",
  };
}

// SQL editor's run-query path. Classifies the SQL in JS using the existing
// lib/query-classifier (same module the SaaS shipped to clients), gates
// write/DDL on a confirmation handshake, then hands the cleared SQL to
// db_run_query. Doc-decided to keep the classifier in TS on desktop rather
// than porting to Rust: classifier-as-safety only matters across a hostile
// client/server boundary, which doesn't exist when the user owns the binary.
async function handleQuery({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] POST /api/query requires a body");
  }
  const { query, confirmed } = body as { query?: string; confirmed?: boolean };
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("[api-tauri] query is required");
  }

  const classification = classifyQuery(query);

  if (classification.kind === "blocked" || classification.kind === "unknown") {
    throw new Error(
      classification.reason ||
        `Statements of type ${classification.statement || "(unknown)"} are not allowed`,
    );
  }

  if ((classification.kind === "write" || classification.kind === "ddl") && !confirmed) {
    return {
      needsConfirmation: true,
      classification: {
        kind: classification.kind,
        statement: classification.statement,
        isBulkWrite: classification.isBulkWrite,
        requiresTypedConfirmation: requiresTypedConfirmation(classification),
      },
      preview: query,
    };
  }

  const result = await invoke<{
    rows: unknown[];
    executionTime: number;
    fields: unknown[];
  }>("db_run_query", { sessionId: sid, sql: query });

  return {
    ...result,
    classification: {
      kind: classification.kind,
      statement: classification.statement,
      isBulkWrite: classification.isBulkWrite,
    },
  };
}

async function handleImport({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] /api/import requires a body");
  }
  const { schema, table, columns, rows, batchSize } = body as {
    schema?: string;
    table?: string;
    columns?: unknown;
    rows?: unknown;
    batchSize?: number;
  };
  if (!schema || !table) {
    throw new Error("[api-tauri] schema and table are required");
  }
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    throw new Error("[api-tauri] columns and rows must be arrays");
  }
  return invoke("db_import", {
    sessionId: sid,
    schema,
    table,
    columns,
    rows,
    batchSize,
  });
}

async function handleExplain({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] /api/explain requires a body");
  }
  const { query } = body as { query?: string };
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("[api-tauri] query is required");
  }
  return invoke("db_explain", { sessionId: sid, query });
}

async function handleCascadePreview({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] /api/cascade-preview requires a body");
  }
  const { deletes, options } = body as { deletes?: unknown; options?: unknown };
  if (!Array.isArray(deletes) || deletes.length === 0) {
    throw new Error("[api-tauri] `deletes` must be a non-empty array");
  }
  return invoke("db_cascade_preview", { sessionId: sid, deletes, options });
}

async function handleLookupRow({ invoke, body }: HandlerCtx): Promise<unknown> {
  const sid = requireSession();
  if (!body || typeof body !== "object") {
    throw new Error("[api-tauri] /api/lookup-row requires a body");
  }
  const { schema, table, column, value } = body as {
    schema?: string;
    table?: string;
    column?: string;
    value?: unknown;
  };
  if (!schema || !table || !column) {
    throw new Error("[api-tauri] /api/lookup-row needs schema, table, and column");
  }
  return invoke("db_lookup_row", {
    sessionId: sid,
    schema,
    table,
    column,
    value: value ?? null,
  });
}

// --- helpers ---

function requireSession(): string {
  if (!sessionId) {
    throw new Error("Not connected. Connect to a database first.");
  }
  return sessionId;
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function parseUrl(url: string): { path: string; params: URLSearchParams } {
  // axios accepts both absolute and relative URLs; we only ever pass /api/*.
  const qIdx = url.indexOf("?");
  if (qIdx < 0) return { path: url, params: new URLSearchParams() };
  return {
    path: url.slice(0, qIdx),
    params: new URLSearchParams(url.slice(qIdx + 1)),
  };
}

interface ConnectConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  type?: string;
}

function extractConnectConfig(body: unknown): ConnectConfig {
  if (!body || typeof body !== "object") {
    throw new Error("connect: body must be an object");
  }
  const b = body as Record<string, unknown>;
  // Web accepts both { config: {...} } and a raw config — mirror that.
  const raw = (
    b.config && typeof b.config === "object" ? b.config : b
  ) as Record<string, unknown>;
  return {
    host: String(raw.host ?? ""),
    port: Number(raw.port ?? 5432),
    database: String(raw.database ?? ""),
    username: String(raw.username ?? ""),
    password: String(raw.password ?? ""),
    ssl: Boolean(raw.ssl ?? false),
    type: typeof raw.type === "string" ? raw.type : undefined,
  };
}
