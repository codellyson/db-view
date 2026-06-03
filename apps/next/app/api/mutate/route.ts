import { NextRequest, NextResponse } from "next/server";
import { getSessionProvider } from "@/lib/db";
import {
  buildUpdateQuery,
  buildInsertQuery,
  buildDeleteQuery,
  type MutationRequest,
} from "@/lib/mutation";
import { sanitizeError } from "@/lib/security";
import { mutateLimiter } from "@/lib/rate-limit";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  if (process.env.DBVIEW_READ_ONLY === "true") {
    return NextResponse.json(
      { error: "Database is in read-only mode" },
      { status: 403 }
    );
  }

  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("db-session")?.value;

    const rl = mutateLimiter.check(sessionId || "anonymous");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    const { provider } = await getSessionProvider();

    const body: MutationRequest = await request.json();

    if (!body.type || !body.schema || !body.table) {
      return NextResponse.json(
        { error: "Missing required fields: type, schema, table" },
        { status: 400 }
      );
    }

    const dialect = provider.type;
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
          body.where,
          dialect
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
          body.values,
          dialect
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
          body.where,
          dialect
        ));
        break;
      default:
        return NextResponse.json(
          { error: "Invalid mutation type. Use INSERT, UPDATE, or DELETE" },
          { status: 400 }
        );
    }

    const result = await provider.query(sql, params);
    return NextResponse.json({
      success: true,
      affectedRows: result.rowCount,
      rows: result.rows,
    });
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
