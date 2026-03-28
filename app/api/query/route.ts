import { NextRequest, NextResponse } from "next/server";
import { executeQuery, ensurePool, getPool } from "@/lib/db";
import { validateQuery, sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
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

    const { query } = await request.json();

    const validation = validateQuery(query);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid query" },
        { status: 400 }
      );
    }

    const result = await executeQuery(query);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Query execution error:", error);
    const message = error.sqlMessage || error.message || "Query execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
