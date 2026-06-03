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

interface BatchBody {
  changes: MutationRequest[];
}

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
    const body: BatchBody = await request.json();

    if (!Array.isArray(body.changes) || body.changes.length === 0) {
      return NextResponse.json(
        { error: "Batch requires a non-empty `changes` array" },
        { status: 400 }
      );
    }

    const dialect = provider.type;
    const statements: { sql: string; params: any[] }[] = [];

    for (let i = 0; i < body.changes.length; i++) {
      const change = body.changes[i];
      if (!change.type || !change.schema || !change.table) {
        return NextResponse.json(
          { error: `Change at index ${i} missing type/schema/table` },
          { status: 400 }
        );
      }
      try {
        if (change.type === "UPDATE") {
          if (!change.values || !change.where) {
            throw new Error("UPDATE requires values and where");
          }
          statements.push(
            buildUpdateQuery(change.schema, change.table, change.values, change.where, dialect)
          );
        } else if (change.type === "INSERT") {
          if (!change.values) throw new Error("INSERT requires values");
          statements.push(buildInsertQuery(change.schema, change.table, change.values, dialect));
        } else if (change.type === "DELETE") {
          if (!change.where) throw new Error("DELETE requires where");
          statements.push(buildDeleteQuery(change.schema, change.table, change.where, dialect));
        } else {
          throw new Error(`Unknown mutation type: ${(change as any).type}`);
        }
      } catch (err: any) {
        return NextResponse.json(
          { error: `Change at index ${i}: ${err.message || err}` },
          { status: 400 }
        );
      }
    }

    const { rowCounts } = await provider.runTransaction(statements);
    return NextResponse.json({ success: true, rowCounts });
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
