import { NextRequest, NextResponse } from "next/server";
import { getTables, getPool, ensurePool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    let pool = getPool();

    if (!pool) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;

      try {
        pool = await ensurePool(sessionId);
      } catch (ensureError: any) {
        return NextResponse.json(
          {
            error:
              ensureError.message ||
              "No database connection. Please connect to a database first.",
          },
          { status: 400 }
        );
      }
    }

    const schema = request.nextUrl.searchParams.get("schema") || "public";
    const tables = await getTables(schema);
    return NextResponse.json({ tables });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
