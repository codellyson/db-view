import { DBConfig } from "@/types";

export type DatabaseType = "postgresql" | "mysql" | "sqlite";

export interface QueryResult {
  rows: any[];
  rowCount?: number;
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

  // Query execution
  executeQuery(
    query: string,
    timeout?: number
  ): Promise<{ rows: any[]; executionTime: number }>;
  executeExplain(
    query: string,
    timeout?: number
  ): Promise<{ plan: any; executionTime: number }>;

  // Generic parameterized query (used by mutation API)
  query(sql: string, params: any[]): Promise<QueryResult>;

  // Health check support
  getHealthInfo(): { totalCount: number; idleCount: number };
  healthPing(): Promise<void>;
}
