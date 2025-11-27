import { NextRequest, NextResponse } from "next/server";
import { getTableSchema, ensurePool, getPool } from "@/lib/db";
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

    const schema = await getTableSchema(params.name);
    return NextResponse.json({ schema });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch table schema" },
      { status: 500 }
    );
  }
}
