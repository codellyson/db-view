import type { QueryFieldInfo } from "./db-provider";

export type EditabilityReason =
  | "unsafe-sql-shape"
  | "no-fields"
  | "multi-table"
  | "unknown-source"
  | "missing-primary-key";

export type EditabilityResult =
  | { editable: false; reason: EditabilityReason; detail?: string }
  | {
      editable: true;
      schema: string;
      table: string;
      primaryKeys: string[];
      // Map of *result column name* -> the underlying base-table column name.
      // Result columns not present in this map are read-only (computed,
      // literal, aggregate, etc.) even though the rest of the row is editable.
      columnToSource: Record<string, string>;
    };

// Blunt lexer-free sniff for constructs that defeat row->table mapping.
// Matches outside of string literals and line/block comments. False positives
// here are safe (they just mean read-only); false negatives are prevented
// by the metadata-level checks below.
const UNSAFE_KEYWORDS = [
  "distinct",
  "group\\s+by",
  "union",
  "intersect",
  "except",
  "having",
  "\\bjoin\\b",
];

function stripNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

export function hasUnsafeSqlShape(sql: string): boolean {
  const cleaned = stripNoise(sql).toLowerCase();
  return UNSAFE_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(cleaned));
}

export interface AnalyzeInput {
  sql: string;
  fields: QueryFieldInfo[] | undefined;
  // Lookup of primary keys for a (schema, table) pair. Returns undefined
  // when the caller has no information about that table (treated as
  // missing-primary-key).
  getPrimaryKeys: (schema: string, table: string) => string[] | undefined;
}

export function analyzeEditability(input: AnalyzeInput): EditabilityResult {
  const { sql, fields, getPrimaryKeys } = input;

  if (!fields || fields.length === 0) {
    return { editable: false, reason: "no-fields" };
  }

  if (hasUnsafeSqlShape(sql)) {
    return { editable: false, reason: "unsafe-sql-shape" };
  }

  // Gather the unique (schema, table) pairs that any column traces back to.
  const sources = new Set<string>();
  let schema = "";
  let table = "";
  for (const f of fields) {
    if (f.source) {
      const key = `${f.source.schema}.${f.source.table}`;
      if (!sources.has(key)) {
        sources.add(key);
        schema = f.source.schema;
        table = f.source.table;
      }
    }
  }

  if (sources.size === 0) {
    return { editable: false, reason: "unknown-source" };
  }
  if (sources.size > 1) {
    return { editable: false, reason: "multi-table" };
  }

  const primaryKeys = getPrimaryKeys(schema, table);
  if (!primaryKeys || primaryKeys.length === 0) {
    return { editable: false, reason: "missing-primary-key", detail: `${schema}.${table} has no primary key` };
  }

  // Build the result-column -> base-column map. Result aliases get handled
  // here: if the user wrote `SELECT id AS user_id FROM users`, the result
  // column name is `user_id` but the underlying column is `id`.
  const columnToSource: Record<string, string> = {};
  for (const f of fields) {
    if (f.source && f.source.schema === schema && f.source.table === table) {
      columnToSource[f.name] = f.source.column;
    }
  }

  // Every PK must appear in the result; otherwise we can't build a WHERE.
  const resultColumnsFromBase = new Set(Object.values(columnToSource));
  const missingPk = primaryKeys.filter((pk) => !resultColumnsFromBase.has(pk));
  if (missingPk.length > 0) {
    return {
      editable: false,
      reason: "missing-primary-key",
      detail: `missing ${missingPk.join(", ")} in result`,
    };
  }

  return { editable: true, schema, table, primaryKeys, columnToSource };
}

export function describeReason(r: EditabilityReason): string {
  switch (r) {
    case "unsafe-sql-shape":
      return "Query uses DISTINCT, GROUP BY, UNION, HAVING, or JOIN";
    case "no-fields":
      return "No column metadata returned";
    case "multi-table":
      return "Columns come from more than one table";
    case "unknown-source":
      return "Driver did not report column origin (e.g. SQLite)";
    case "missing-primary-key":
      return "Result is missing the primary key of the source table";
  }
}
