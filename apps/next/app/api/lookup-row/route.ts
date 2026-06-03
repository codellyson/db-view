import { NextRequest, NextResponse } from "next/server";
import { getSessionProvider } from "@/lib/db";
import { escapeIdentifier, placeholder, validateIdentifier } from "@/lib/mutation";
import { sanitizeError } from "@/lib/security";

interface LookupBody {
  schema: string;
  table: string;
  column: string;
  value: any;
}

/**
 * Fetch up to 2 rows from `schema.table` where `column = value`. Used by
 * FK navigation: the side panel shows the unique target row (or flags when
 * the FK lookup returns more than one row, which would indicate a schema
 * issue — FK targets are typically unique).
 */
export async function POST(request: NextRequest) {
  try {
    const { provider } = await getSessionProvider();
    const body: LookupBody = await request.json();
    if (!body.schema || !body.table || !body.column) {
      return NextResponse.json(
        { error: "Missing schema, table, or column" },
        { status: 400 }
      );
    }
    validateIdentifier(body.schema);
    validateIdentifier(body.table);
    validateIdentifier(body.column);

    const dialect = provider.type;
    const esc = (n: string) => escapeIdentifier(n, dialect);
    const qualified =
      dialect === "sqlite" ? esc(body.table) : `${esc(body.schema)}.${esc(body.table)}`;
    const sql = `SELECT * FROM ${qualified} WHERE ${esc(body.column)} = ${placeholder(1, dialect)} LIMIT 2`;
    const result = await provider.query(sql, [body.value]);
    return NextResponse.json({ rows: result.rows });
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
