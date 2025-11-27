import { NextRequest, NextResponse } from "next/server";
import { getTableData, ensurePool, getPool } from "@/lib/db";
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

    const { rows, total } = await getTableData(params.name, limit, offset);
    return NextResponse.json({ rows, total, limit, offset });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch table data" },
      { status: 500 }
    );
  }
}
