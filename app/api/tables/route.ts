import { NextResponse } from "next/server";
import { getTables, getPool, ensurePool } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    let pool = getPool();
    console.log("Initial pool state:", pool ? "exists" : "null");

    if (!pool) {
      console.log("Pool is null, attempting to ensure pool from session...");
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;

      try {
        pool = await ensurePool(sessionId);
        console.log("Pool recreated successfully from session");
      } catch (ensureError: any) {
        console.error("Failed to ensure pool:", ensureError.message);
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

    const tables = await getTables();
    console.log(`Successfully fetched ${tables.length} tables`);
    return NextResponse.json({ tables });
  } catch (error: any) {
    console.error("Error fetching tables:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      { error: error.message || "Failed to fetch tables" },
      { status: 500 }
    );
  }
}
