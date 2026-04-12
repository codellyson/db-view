import { NextRequest, NextResponse } from "next/server";
import { executeQuery, ensurePool, getPool } from "@/lib/db";
import { validateQuery, sanitizeError } from "@/lib/security";
import { classifyQuery, requiresTypedConfirmation } from "@/lib/query-classifier";
import { queryLimiter } from "@/lib/rate-limit";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("db-session")?.value || "anonymous";

    const rl = queryLimiter.check(sessionId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    if (!getPool()) {
      try {
        await ensurePool(sessionId === "anonymous" ? undefined : sessionId);
      } catch (ensureError: any) {
        return NextResponse.json(
          { error: ensureError.message || "No database connection. Please connect to a database first." },
          { status: 400 }
        );
      }
    }

    const body = await request.json();
    const { query, confirmed } = body as { query: string; confirmed?: boolean };

    const validation = validateQuery(query);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid query" },
        { status: 400 }
      );
    }

    const classification = classifyQuery(query);

    if (classification.kind === "blocked" || classification.kind === "unknown") {
      return NextResponse.json(
        {
          error:
            classification.reason ||
            `Statements of type ${classification.statement || "(unknown)"} are not allowed`,
        },
        { status: 400 }
      );
    }

    // Writes and DDL require an explicit confirmation handshake. The server
    // refuses to execute until the client re-POSTs with `confirmed: true`.
    if (classification.kind === "write" || classification.kind === "ddl") {
      if (!confirmed) {
        return NextResponse.json({
          needsConfirmation: true,
          classification: {
            kind: classification.kind,
            statement: classification.statement,
            isBulkWrite: classification.isBulkWrite,
            requiresTypedConfirmation: requiresTypedConfirmation(classification),
          },
          preview: query,
        });
      }
    }

    const result = await executeQuery(query);
    return NextResponse.json({
      ...result,
      classification: {
        kind: classification.kind,
        statement: classification.statement,
        isBulkWrite: classification.isBulkWrite,
      },
    });
  } catch (error: any) {
    console.error("Query execution error:", error);
    const message = sanitizeError(error) || error.sqlMessage || error.message || "Query execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
