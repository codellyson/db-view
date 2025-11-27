import { NextRequest, NextResponse } from "next/server";
import { executeQuery, ensurePool, getPool } from "@/lib/db";
import { validateQuery, sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    if (!getPool()) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;
      await ensurePool(sessionId);
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
    const sanitizedError = sanitizeError(error);
    console.error("Query execution error:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
