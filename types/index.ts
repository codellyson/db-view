export interface DBConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  type?: "postgresql" | "mysql";
}

export interface SavedConnection {
  id: string;
  name: string;
  config: DBConfig;
  createdAt: number;
  lastUsed?: number;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isPrimaryKey?: boolean;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default?: string | null;
  isPrimaryKey?: boolean;
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface Constraint {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check';
  columns: string[];
}

export interface QueryHistoryEntry {
  id: string;
  query: string;
  executionTime: number;
  rowCount: number;
  timestamp: number;
  isFavorite: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
}

export interface TableDefinition {
  name: string;
  schema: string;
  columns: ColumnDefinition[];
}

export interface PinnedResult {
  id: string;
  query: string;
  columns: string[];
  data: any[];
  executionTime: number;
  pinnedAt: number;
}

