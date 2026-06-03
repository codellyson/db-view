import { NextRequest, NextResponse } from "next/server";
import { getTableStats, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
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

    const schemaName = request.nextUrl.searchParams.get("schema") || "public";
    const stats = await getTableStats(name, schemaName);

    if (!stats) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    return NextResponse.json({ stats });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
