import { NextRequest, NextResponse } from "next/server";
import { ensurePool, getPool, getProvider, getDatabaseType } from "@/lib/db";
import { validateIdentifier } from "@/lib/mutation";
import { buildBulkInsertQuery } from "@/lib/import-utils";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

const DEFAULT_BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  if (process.env.DBVIEW_READ_ONLY === "true") {
    return NextResponse.json(
      { error: "Database is in read-only mode" },
      { status: 403 }
    );
  }

  try {
    if (!getPool()) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;
      if (sessionId) {
        await ensurePool(sessionId);
      }
    }

    const provider = getProvider();
    if (!provider) {
      return NextResponse.json(
        { error: "Not connected to a database" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { schema, table, columns, rows, batchSize = DEFAULT_BATCH_SIZE } = body;

    if (!schema || !table || !columns || !rows) {
      return NextResponse.json(
        { error: "Missing required fields: schema, table, columns, rows" },
        { status: 400 }
      );
    }

    if (!Array.isArray(columns) || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "columns and rows must be arrays" },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No rows to import" },
        { status: 400 }
      );
    }

    // Validate identifiers
    try {
      validateIdentifier(schema);
      validateIdentifier(table);
      columns.forEach((col: string) => validateIdentifier(col));
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const dialect = getDatabaseType();
    let insertedRows = 0;

    // Execute in batches within a transaction
    await provider.query("BEGIN", []);

    try {
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { sql, params } = buildBulkInsertQuery(
          schema,
          table,
          columns,
          batch,
          dialect
        );
        await provider.query(sql, params);
        insertedRows += batch.length;
      }
      await provider.query("COMMIT", []);
    } catch (err) {
      await provider.query("ROLLBACK", []).catch(() => {});
      throw err;
    }

    return NextResponse.json({ success: true, insertedRows });
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
