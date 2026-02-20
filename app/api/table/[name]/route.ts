import { NextRequest, NextResponse } from "next/server";
import { getTableData, ensurePool, getPool } from "@/lib/db";
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

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const sortColumn = searchParams.get("sortColumn") || undefined;
    const sortDir = searchParams.get("sortDirection");
    const sortDirection = sortDir === "asc" || sortDir === "desc" ? sortDir : undefined;

    const schema = searchParams.get("schema") || "public";
    const { rows, total, countIsEstimate } = await getTableData(params.name, limit, offset, sortColumn, sortDirection, schema);
    return NextResponse.json({ rows, total, limit, offset, countIsEstimate });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Table data fetch error:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
