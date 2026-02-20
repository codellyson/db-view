import { NextRequest, NextResponse } from "next/server";
import { getTableSchema, ensurePool, getPool } from "@/lib/db";
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
    const schema = await getTableSchema(params.name, schemaName);
    return NextResponse.json({ schema });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Schema fetch error:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
