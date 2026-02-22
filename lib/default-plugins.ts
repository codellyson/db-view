import type { QueryTemplate, ColumnFormatter } from "./plugin-types";

export const DEFAULT_TEMPLATES: QueryTemplate[] = [
  {
    id: "builtin_pg_table_sizes",
    name: "Table Sizes",
    description: "Show all tables ordered by total size",
    sql: `SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) AS index_size
FROM pg_tables
WHERE schemaname = '{{schema_name}}'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;`,
    tags: ["size", "storage"],
    dialect: "postgresql",
    category: "performance",
    isBuiltIn: true,
    variables: [
      { name: "schema_name", label: "Schema", type: "text", defaultValue: "public" },
    ],
  },
  {
    id: "builtin_mysql_table_sizes",
    name: "Table Sizes",
    description: "Show all tables ordered by total size",
    sql: `SELECT TABLE_NAME,
  CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2), ' MB') AS total_size,
  CONCAT(ROUND(DATA_LENGTH / 1024 / 1024, 2), ' MB') AS table_size,
  CONCAT(ROUND(INDEX_LENGTH / 1024 / 1024, 2), ' MB') AS index_size
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = '{{schema_name}}'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;`,
    tags: ["size", "storage"],
    dialect: "mysql",
    category: "performance",
    isBuiltIn: true,
    variables: [
      { name: "schema_name", label: "Schema", type: "text" },
    ],
  },
  {
    id: "builtin_duplicate_rows",
    name: "Find Duplicate Rows",
    description: "Find duplicate rows based on specified columns",
    sql: `SELECT {{column_list}}, COUNT(*) AS duplicate_count
FROM {{table_name}}
GROUP BY {{column_list}}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;`,
    tags: ["data-quality", "duplicates"],
    dialect: "universal",
    category: "data",
    isBuiltIn: true,
    variables: [
      { name: "table_name", label: "Table", type: "text" },
      { name: "column_list", label: "Columns (comma-separated)", type: "text" },
    ],
  },
  {
    id: "builtin_pg_active_locks",
    name: "Active Locks",
    description: "Show current lock activity",
    sql: `SELECT l.locktype, l.relation::regclass, l.mode, l.granted,
  a.pid, a.usename, a.query, a.state
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE a.pid != pg_backend_pid()
ORDER BY l.granted, a.query_start;`,
    tags: ["locks", "debugging"],
    dialect: "postgresql",
    category: "admin",
    isBuiltIn: true,
    variables: [],
  },
  {
    id: "builtin_pg_index_usage",
    name: "Index Usage Statistics",
    description: "Show which indexes are being used and which are not",
    sql: `SELECT schemaname, relname AS table_name, indexrelname AS index_name,
  idx_scan AS times_used, idx_tup_read, idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = '{{schema_name}}'
ORDER BY idx_scan ASC;`,
    tags: ["indexes", "performance"],
    dialect: "postgresql",
    category: "performance",
    isBuiltIn: true,
    variables: [
      { name: "schema_name", label: "Schema", type: "text", defaultValue: "public" },
    ],
  },
  {
    id: "builtin_pg_long_running",
    name: "Long-Running Queries",
    description: "Show queries running longer than 5 seconds",
    sql: `SELECT pid, usename, state,
  now() - query_start AS duration,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;`,
    tags: ["performance", "debugging"],
    dialect: "postgresql",
    category: "performance",
    isBuiltIn: true,
    variables: [],
  },
  {
    id: "builtin_mysql_processlist",
    name: "Active Processes",
    description: "Show currently running MySQL processes",
    sql: `SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO
FROM information_schema.PROCESSLIST
WHERE COMMAND != 'Sleep'
ORDER BY TIME DESC;`,
    tags: ["processes", "debugging"],
    dialect: "mysql",
    category: "admin",
    isBuiltIn: true,
    variables: [],
  },
  {
    id: "builtin_pg_unused_indexes",
    name: "Unused Indexes",
    description: "Find indexes that have never been scanned",
    sql: `SELECT schemaname, relname AS table_name, indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = '{{schema_name}}'
ORDER BY pg_relation_size(indexrelid) DESC;`,
    tags: ["indexes", "cleanup"],
    dialect: "postgresql",
    category: "performance",
    isBuiltIn: true,
    variables: [
      { name: "schema_name", label: "Schema", type: "text", defaultValue: "public" },
    ],
  },
];

export const DEFAULT_FORMATTERS: ColumnFormatter[] = [
  {
    id: "builtin_relative_date",
    name: "Relative Dates",
    description: "Show timestamps as relative time (e.g., '3 days ago')",
    matcher: { type: "data-type", value: "timestamp" },
    preset: "relative-date",
    isBuiltIn: true,
  },
  {
    id: "builtin_json_pretty",
    name: "Pretty JSON",
    description: "Format JSON/JSONB columns with indentation",
    matcher: { type: "data-type", value: "json" },
    preset: "json-pretty",
    isBuiltIn: true,
  },
  {
    id: "builtin_boolean_badge",
    name: "Boolean Badges",
    description: "Show booleans as colored badges",
    matcher: { type: "data-type", value: "boolean" },
    preset: "boolean-badge",
    isBuiltIn: true,
  },
  {
    id: "builtin_number_comma",
    name: "Comma-Separated Numbers",
    description: "Format large numbers with comma separators",
    matcher: { type: "data-type", value: "bigint" },
    preset: "number-comma",
    isBuiltIn: true,
  },
  {
    id: "builtin_truncate_text",
    name: "Truncate Long Text",
    description: "Truncate text columns longer than 200 characters",
    matcher: { type: "data-type", value: "text" },
    preset: "truncate-long",
    isBuiltIn: true,
  },
];
