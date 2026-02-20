import { NextRequest, NextResponse } from "next/server";
import { getTableRelationships, getTableIndexes, ensurePool, getPool } from "@/lib/db";
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

    const schema = request.nextUrl.searchParams.get("schema") || "public";
    const [relationships, indexes] = await Promise.all([
      getTableRelationships(params.name, schema),
      getTableIndexes(params.name, schema),
    ]);

    return NextResponse.json({ relationships, indexes });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Relationships fetch error:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
