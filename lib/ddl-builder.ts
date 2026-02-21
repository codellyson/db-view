import { escapeIdentifier, type Dialect } from "./mutation";
import { TableDefinition } from "@/types";

export const COLUMN_TYPES: Record<Dialect, string[]> = {
  postgresql: [
    "integer",
    "bigint",
    "serial",
    "bigserial",
    "smallint",
    "text",
    "varchar(255)",
    "char(1)",
    "boolean",
    "timestamp",
    "timestamptz",
    "date",
    "time",
    "numeric",
    "decimal",
    "real",
    "double precision",
    "jsonb",
    "json",
    "uuid",
    "bytea",
  ],
  mysql: [
    "INT",
    "BIGINT",
    "SMALLINT",
    "TINYINT",
    "VARCHAR(255)",
    "CHAR(1)",
    "TEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
    "BOOLEAN",
    "DATETIME",
    "TIMESTAMP",
    "DATE",
    "TIME",
    "DECIMAL(10,2)",
    "FLOAT",
    "DOUBLE",
    "JSON",
    "BLOB",
    "ENUM('')",
  ],
};

export function buildCreateTableSQL(
  definition: TableDefinition,
  dialect: Dialect
): string {
  const esc = (name: string) => escapeIdentifier(name, dialect);
  const lines: string[] = [];
  const pkColumns: string[] = [];

  for (const col of definition.columns) {
    const parts: string[] = [esc(col.name)];

    // Handle auto-increment types
    let colType = col.type;
    if (dialect === "mysql" && col.isPrimaryKey && (colType === "INT" || colType === "BIGINT")) {
      parts.push(colType);
      parts.push("AUTO_INCREMENT");
    } else {
      parts.push(colType);
    }

    if (!col.nullable) {
      parts.push("NOT NULL");
    }

    if (col.isUnique && !col.isPrimaryKey) {
      parts.push("UNIQUE");
    }

    if (col.defaultValue !== undefined && col.defaultValue !== "") {
      parts.push(`DEFAULT ${col.defaultValue}`);
    }

    lines.push(`  ${parts.join(" ")}`);

    if (col.isPrimaryKey) {
      pkColumns.push(esc(col.name));
    }
  }

  if (pkColumns.length > 0) {
    lines.push(`  PRIMARY KEY (${pkColumns.join(", ")})`);
  }

  const tableName = `${esc(definition.schema)}.${esc(definition.name)}`;
  let sql = `CREATE TABLE ${tableName} (\n${lines.join(",\n")}\n)`;

  if (dialect === "mysql") {
    sql += " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
  }

  return sql + ";";
}
