import { NextResponse } from "next/server";
import { getSchemas, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET() {
  try {
    if (!getPool()) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;
      await ensurePool(sessionId);
    }

    const schemas = await getSchemas();
    return NextResponse.json({ schemas });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Error fetching schemas:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
