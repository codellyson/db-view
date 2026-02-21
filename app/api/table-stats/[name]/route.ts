import { NextRequest, NextResponse } from "next/server";
import { getTableStats, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    if (!getPool()) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;
      await ensurePool(sessionId);
    }

    const schemaName = request.nextUrl.searchParams.get("schema") || "public";
    const stats = await getTableStats(params.name, schemaName);

    if (!stats) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    return NextResponse.json({ stats });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
