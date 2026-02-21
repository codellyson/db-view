import { NextRequest, NextResponse } from "next/server";
import { ensurePool, getPool } from "@/lib/db";
import {
  buildUpdateQuery,
  buildInsertQuery,
  buildDeleteQuery,
  type MutationRequest,
} from "@/lib/mutation";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

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

    const activePool = getPool();
    if (!activePool) {
      return NextResponse.json(
        { error: "Not connected to a database" },
        { status: 401 }
      );
    }

    const body: MutationRequest = await request.json();

    if (!body.type || !body.schema || !body.table) {
      return NextResponse.json(
        { error: "Missing required fields: type, schema, table" },
        { status: 400 }
      );
    }

    let sql: string;
    let params: any[];

    switch (body.type) {
      case "UPDATE":
        if (!body.values || !body.where) {
          return NextResponse.json(
            { error: "UPDATE requires values and where" },
            { status: 400 }
          );
        }
        ({ sql, params } = buildUpdateQuery(
          body.schema,
          body.table,
          body.values,
          body.where
        ));
        break;
      case "INSERT":
        if (!body.values) {
          return NextResponse.json(
            { error: "INSERT requires values" },
            { status: 400 }
          );
        }
        ({ sql, params } = buildInsertQuery(
          body.schema,
          body.table,
          body.values
        ));
        break;
      case "DELETE":
        if (!body.where) {
          return NextResponse.json(
            { error: "DELETE requires where" },
            { status: 400 }
          );
        }
        ({ sql, params } = buildDeleteQuery(
          body.schema,
          body.table,
          body.where
        ));
        break;
      default:
        return NextResponse.json(
          { error: "Invalid mutation type. Use INSERT, UPDATE, or DELETE" },
          { status: 400 }
        );
    }

    const client = await activePool.connect();
    try {
      const result = await client.query(sql, params);
      return NextResponse.json({
        success: true,
        affectedRows: result.rowCount,
        rows: result.rows,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
