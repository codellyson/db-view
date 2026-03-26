import { NextResponse } from "next/server";
import { getPool, ensurePool, getProvider } from "@/lib/db";
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
          { error: ensureError.message || "No database connection. Please connect to a database first." },
          { status: 400 }
        );
      }
    }

    const provider = getProvider();
    if (!provider) {
      return NextResponse.json({ queries: [] });
    }

    let queries: any[] = [];

    if (provider.type === "postgresql") {
      const result = await provider.query(
        `SELECT
          pid,
          usename AS username,
          datname AS database,
          state,
          query,
          EXTRACT(EPOCH FROM (NOW() - query_start))::integer * 1000 AS duration_ms,
          wait_event_type,
          wait_event
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND pid != pg_backend_pid()
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY query_start ASC`,
        []
      );
      queries = result.rows;
    } else {
      const result = await provider.query(
        `SELECT
          ID AS pid,
          USER AS username,
          DB AS \`database\`,
          COMMAND AS state,
          INFO AS query,
          TIME * 1000 AS duration_ms
        FROM information_schema.PROCESSLIST
        WHERE COMMAND != 'Sleep'
          AND ID != CONNECTION_ID()
          AND INFO NOT LIKE '%PROCESSLIST%'
        ORDER BY TIME DESC`,
        []
      );
      queries = result.rows;
    }

    return NextResponse.json({ queries });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Active queries error:", error);
    return NextResponse.json({ error: sanitizedError, queries: [] }, { status: 500 });
  }
}
