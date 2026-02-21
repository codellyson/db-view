export interface MutationRequest {
  type: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  values?: Record<string, any>;
  where?: Record<string, any>;
}

function validateIdentifier(name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
}

export function buildUpdateQuery(
  schema: string,
  table: string,
  values: Record<string, any>,
  primaryKeys: Record<string, any>
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);

  const setClauses: string[] = [];
  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [col, val] of Object.entries(values)) {
    validateIdentifier(col);
    setClauses.push(`"${col}" = $${paramIndex}`);
    params.push(val === "" ? null : val);
    paramIndex++;
  }

  for (const [col, val] of Object.entries(primaryKeys)) {
    validateIdentifier(col);
    whereClauses.push(`"${col}" = $${paramIndex}`);
    params.push(val);
    paramIndex++;
  }

  if (setClauses.length === 0) {
    throw new Error("UPDATE requires at least one value to set");
  }
  if (whereClauses.length === 0) {
    throw new Error("UPDATE requires at least one primary key condition");
  }

  const sql = `UPDATE "${schema}"."${table}" SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`;
  return { sql, params };
}

export function buildInsertQuery(
  schema: string,
  table: string,
  values: Record<string, any>
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);

  const columns: string[] = [];
  const placeholders: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [col, val] of Object.entries(values)) {
    if (val === "" || val === undefined) continue;
    validateIdentifier(col);
    columns.push(`"${col}"`);
    placeholders.push(`$${paramIndex}`);
    params.push(val === "NULL" ? null : val);
    paramIndex++;
  }

  if (columns.length === 0) {
    throw new Error("INSERT requires at least one value");
  }

  const sql = `INSERT INTO "${schema}"."${table}" (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`;
  return { sql, params };
}

export function buildDeleteQuery(
  schema: string,
  table: string,
  primaryKeys: Record<string, any>
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);

  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [col, val] of Object.entries(primaryKeys)) {
    validateIdentifier(col);
    whereClauses.push(`"${col}" = $${paramIndex}`);
    params.push(val);
    paramIndex++;
  }

  if (whereClauses.length === 0) {
    throw new Error("DELETE requires at least one primary key condition");
  }

  const sql = `DELETE FROM "${schema}"."${table}" WHERE ${whereClauses.join(" AND ")}`;
  return { sql, params };
}

export function buildDisplaySQL(request: MutationRequest): string {
  try {
    let result: { sql: string; params: any[] };
    switch (request.type) {
      case "UPDATE":
        result = buildUpdateQuery(
          request.schema,
          request.table,
          request.values!,
          request.where!
        );
        break;
      case "INSERT":
        result = buildInsertQuery(
          request.schema,
          request.table,
          request.values!
        );
        break;
      case "DELETE":
        result = buildDeleteQuery(
          request.schema,
          request.table,
          request.where!
        );
        break;
    }
    // Replace $N placeholders with quoted values for display
    let display = result.sql;
    result.params.forEach((param, i) => {
      const val =
        param === null
          ? "NULL"
          : typeof param === "number"
            ? String(param)
            : `'${String(param).replace(/'/g, "''")}'`;
      display = display.replace(`$${i + 1}`, val);
    });
    return display;
  } catch {
    return "-- Unable to generate preview --";
  }
}
