export type Dialect = "postgresql" | "mysql" | "sqlite";

export interface MutationRequest {
  type: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  values?: Record<string, any>;
  where?: Record<string, any>;
}

export function validateIdentifier(name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
}

export function escapeIdentifier(name: string, dialect: Dialect): string {
  if (dialect === "mysql") return `\`${name.replace(/`/g, "``")}\``;
  // PostgreSQL and SQLite both use double-quote escaping
  return `"${name.replace(/"/g, '""')}"`;
}

export function placeholder(index: number, dialect: Dialect): string {
  if (dialect === "mysql") return "?";
  if (dialect === "sqlite") return "?";
  return `$${index}`;
}

export function buildUpdateQuery(
  schema: string,
  table: string,
  values: Record<string, any>,
  primaryKeys: Record<string, any>,
  dialect: Dialect = "postgresql"
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);

  const esc = (name: string) => escapeIdentifier(name, dialect);
  const setClauses: string[] = [];
  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [col, val] of Object.entries(values)) {
    validateIdentifier(col);
    setClauses.push(`${esc(col)} = ${placeholder(paramIndex, dialect)}`);
    params.push(val === "" ? null : val);
    paramIndex++;
  }

  for (const [col, val] of Object.entries(primaryKeys)) {
    validateIdentifier(col);
    whereClauses.push(`${esc(col)} = ${placeholder(paramIndex, dialect)}`);
    params.push(val);
    paramIndex++;
  }

  if (setClauses.length === 0) {
    throw new Error("UPDATE requires at least one value to set");
  }
  if (whereClauses.length === 0) {
    throw new Error("UPDATE requires at least one primary key condition");
  }

  const qualifiedTable = dialect === "sqlite"
    ? esc(table)
    : `${esc(schema)}.${esc(table)}`;
  const sql = `UPDATE ${qualifiedTable} SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`;
  return { sql, params };
}

export function buildInsertQuery(
  schema: string,
  table: string,
  values: Record<string, any>,
  dialect: Dialect = "postgresql"
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);

  const esc = (name: string) => escapeIdentifier(name, dialect);
  const columns: string[] = [];
  const placeholders: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [col, val] of Object.entries(values)) {
    if (val === "" || val === undefined) continue;
    validateIdentifier(col);
    columns.push(esc(col));
    placeholders.push(placeholder(paramIndex, dialect));
    params.push(val === "NULL" ? null : val);
    paramIndex++;
  }

  if (columns.length === 0) {
    throw new Error("INSERT requires at least one value");
  }

  const qualifiedTable = dialect === "sqlite"
    ? esc(table)
    : `${esc(schema)}.${esc(table)}`;
  let sql = `INSERT INTO ${qualifiedTable} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
  if (dialect === "postgresql") {
    sql += " RETURNING *";
  }
  return { sql, params };
}

export function buildDeleteQuery(
  schema: string,
  table: string,
  primaryKeys: Record<string, any>,
  dialect: Dialect = "postgresql"
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);

  const esc = (name: string) => escapeIdentifier(name, dialect);
  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [col, val] of Object.entries(primaryKeys)) {
    validateIdentifier(col);
    whereClauses.push(`${esc(col)} = ${placeholder(paramIndex, dialect)}`);
    params.push(val);
    paramIndex++;
  }

  if (whereClauses.length === 0) {
    throw new Error("DELETE requires at least one primary key condition");
  }

  const qualifiedTable = dialect === "sqlite"
    ? esc(table)
    : `${esc(schema)}.${esc(table)}`;
  const sql = `DELETE FROM ${qualifiedTable} WHERE ${whereClauses.join(" AND ")}`;
  return { sql, params };
}

export function buildDisplaySQL(
  request: MutationRequest,
  dialect: Dialect = "postgresql"
): string {
  try {
    let result: { sql: string; params: any[] };
    switch (request.type) {
      case "UPDATE":
        result = buildUpdateQuery(
          request.schema,
          request.table,
          request.values!,
          request.where!,
          dialect
        );
        break;
      case "INSERT":
        result = buildInsertQuery(
          request.schema,
          request.table,
          request.values!,
          dialect
        );
        break;
      case "DELETE":
        result = buildDeleteQuery(
          request.schema,
          request.table,
          request.where!,
          dialect
        );
        break;
    }
    // Replace placeholders with quoted values for display
    let display = result.sql;
    if (dialect === "mysql" || dialect === "sqlite") {
      // Replace ? placeholders left-to-right
      result.params.forEach((param) => {
        const val =
          param === null
            ? "NULL"
            : typeof param === "number"
              ? String(param)
              : `'${String(param).replace(/'/g, "''")}'`;
        display = display.replace("?", val);
      });
    } else {
      result.params.forEach((param, i) => {
        const val =
          param === null
            ? "NULL"
            : typeof param === "number"
              ? String(param)
              : `'${String(param).replace(/'/g, "''")}'`;
        display = display.replace(`$${i + 1}`, val);
      });
    }
    return display;
  } catch {
    return "-- Unable to generate preview --";
  }
}
