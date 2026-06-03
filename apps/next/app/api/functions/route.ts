import { NextRequest, NextResponse } from "next/server";
import { getFunctions, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
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

    const schema = request.nextUrl.searchParams.get("schema") || "public";
    const functions = await getFunctions(schema);

    return NextResponse.json({ functions });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Error fetching functions:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
