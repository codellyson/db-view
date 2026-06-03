import { NextRequest, NextResponse } from "next/server";
import { getTables, getTableSchema, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    if (!getPool()) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;
      try {
        await ensurePool(sessionId);
      } catch (ensureError: any) {
        return NextResponse.json(
          { error: ensureError.message || "No database connection. Please connect to a database first." },
          { status: 400 }
        );
      }
    }

    const schema = request.nextUrl.searchParams.get("schema") || "public";
    const tables = await getTables(schema);

    const schemaMap: Record<string, string[]> = {};

    const results = await Promise.allSettled(
      tables.map(async (table) => {
        const columns = await getTableSchema(table, schema);
        return {
          table,
          columns: columns.map((col: any) => col.column_name ?? col.name),
        };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        schemaMap[result.value.table] = result.value.columns;
      }
    }

    return NextResponse.json({ schemaMap });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
