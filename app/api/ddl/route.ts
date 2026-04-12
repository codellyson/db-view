import { NextRequest, NextResponse } from "next/server";
import { getSessionProvider } from "@/lib/db";
import { sanitizeError } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (process.env.DBVIEW_READ_ONLY === "true") {
    return NextResponse.json(
      { error: "Database is in read-only mode" },
      { status: 403 }
    );
  }

  try {
    const { provider } = await getSessionProvider();

    const { sql } = await request.json();

    if (!sql || typeof sql !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid SQL" },
        { status: 400 }
      );
    }

    // Only allow CREATE TABLE statements
    const normalized = sql.trim().toUpperCase();
    if (!normalized.startsWith("CREATE TABLE")) {
      return NextResponse.json(
        { error: "Only CREATE TABLE statements are allowed" },
        { status: 400 }
      );
    }

    await provider.query(sql, []);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
