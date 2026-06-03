import { DBConfig } from "@/types";

export type DatabaseType = "postgresql" | "mysql" | "sqlite";

export interface QueryResult {
  rows: any[];
  rowCount?: number;
}

export interface QueryFieldInfo {
  name: string;
  dataTypeID: number | null;
  // Origin of this column if it can be resolved to a base table column.
  // Null when the column is computed (expression, literal, aggregate),
  // or when the driver does not expose source metadata (e.g. libsql).
  source: { schema: string; table: string; column: string } | null;
}

export interface ExecuteQueryResult {
  rows: any[];
  executionTime: number;
  fields?: QueryFieldInfo[];
}

export type DeleteRule = "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT";

export interface IncomingForeignKey {
  constraintName: string;
  childSchema: string;
  childTable: string;
  childColumn: string;
  parentColumn: string;
  deleteRule: DeleteRule;
}

export function normalizeDeleteRule(raw: string | null | undefined): DeleteRule {
  const v = (raw ?? "NO ACTION").toUpperCase().trim();
  if (
    v === "CASCADE" ||
    v === "RESTRICT" ||
    v === "NO ACTION" ||
    v === "SET NULL" ||
    v === "SET DEFAULT"
  ) {
    return v;
  }
  return "NO ACTION";
}

export interface DatabaseProvider {
  readonly type: DatabaseType;

  // Pool lifecycle
  createPool(config: DBConfig): void;
  testConnection(config: DBConfig): Promise<boolean>;
  getPool(): any | null;
  endPool(): Promise<void>;

  // Schema introspection
  getSchemas(): Promise<string[]>;
  getTables(schema: string): Promise<string[]>;
  getViews(schema: string): Promise<string[]>;
  getMaterializedViews(schema: string): Promise<string[]>;
  getFunctions(schema: string): Promise<any[]>;
  getTableSchema(tableName: string, schema: string): Promise<any[]>;
  getTableRelationships(tableName: string, schema: string): Promise<any[]>;
  getTableData(
    tableName: string,
    limit: number,
    offset: number,
    sortColumn?: string,
    sortDirection?: "asc" | "desc",
    schema?: string
  ): Promise<{ rows: any[]; total: number; countIsEstimate?: boolean }>;
  getTableIndexes(tableName: string, schema: string): Promise<any[]>;
  getTableStats(tableName: string, schema: string): Promise<any>;

  getIncomingForeignKeys(
    tableName: string,
    schema: string
  ): Promise<IncomingForeignKey[]>;

  // Query execution
  executeQuery(
    query: string,
    timeout?: number
  ): Promise<ExecuteQueryResult>;
  executeExplain(
    query: string,
    timeout?: number
  ): Promise<{ plan: any; executionTime: number }>;

  // Generic parameterized query (used by mutation API)
  query(sql: string, params: any[]): Promise<QueryResult>;

  // Atomic batch — all statements commit together or all roll back.
  // Used by the staged-changes save flow.
  runTransaction(
    statements: { sql: string; params: any[] }[]
  ): Promise<{ rowCounts: number[] }>;

  // Approximate row counts for every table in `schema`. Implementations
  // should prefer cheap statistics (Postgres pg_class.reltuples,
  // MySQL information_schema.tables.table_rows) over full COUNT(*) scans.
  // Returns a record keyed by table name; missing tables imply unknown.
  getTableRowCounts(schema: string): Promise<Record<string, number>>;

  // Health check support
  getHealthInfo(): { totalCount: number; idleCount: number };
  healthPing(): Promise<void>;
}
