import { escapeIdentifier, placeholder, validateIdentifier, type Dialect } from "./mutation";

export function buildBulkInsertQuery(
  schema: string,
  table: string,
  columns: string[],
  rows: any[][],
  dialect: Dialect
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);
  columns.forEach((col) => validateIdentifier(col));

  const esc = (name: string) => escapeIdentifier(name, dialect);
  const colList = columns.map(esc).join(", ");
  const params: any[] = [];
  const valueSets: string[] = [];
  let paramIndex = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    for (const val of row) {
      placeholders.push(placeholder(paramIndex, dialect));
      params.push(val === "" || val === undefined ? null : val);
      paramIndex++;
    }
    valueSets.push(`(${placeholders.join(", ")})`);
  }

  const sql = `INSERT INTO ${esc(schema)}.${esc(table)} (${colList}) VALUES ${valueSets.join(", ")}`;
  return { sql, params };
}
