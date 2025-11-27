export interface DBConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
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

