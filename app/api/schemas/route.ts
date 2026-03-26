import { NextResponse } from "next/server";
import { getSchemas, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET() {
  try {
    if (!getPool()) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;

      try {
        await ensurePool(sessionId);
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

    const schemas = await getSchemas();
    return NextResponse.json({ schemas });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Error fetching schemas:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
