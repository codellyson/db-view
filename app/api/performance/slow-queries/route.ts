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
      return NextResponse.json({ available: false, queries: [] });
    }

    if (provider.type === "postgresql") {
      try {
        // Check if pg_stat_statements extension is available
        const checkResult = await provider.query(
          `SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`,
          []
        );

        if (checkResult.rows.length === 0) {
          return NextResponse.json({
            available: false,
            message: "pg_stat_statements extension is not installed",
            queries: [],
          });
        }

        const result = await provider.query(
          `SELECT
            query,
            calls,
            ROUND(total_exec_time::numeric, 2) AS total_time_ms,
            ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
            ROUND(min_exec_time::numeric, 2) AS min_time_ms,
            ROUND(max_exec_time::numeric, 2) AS max_time_ms,
            rows
          FROM pg_stat_statements
          WHERE query NOT LIKE '%pg_stat_statements%'
          ORDER BY total_exec_time DESC
          LIMIT 20`,
          []
        );

        return NextResponse.json({ available: true, queries: result.rows });
      } catch {
        return NextResponse.json({
          available: false,
          message: "pg_stat_statements is not accessible",
          queries: [],
        });
      }
    } else {
      // MySQL
      try {
        const result = await provider.query(
          `SELECT
            DIGEST_TEXT AS query,
            COUNT_STAR AS calls,
            ROUND(SUM_TIMER_WAIT / 1000000000, 2) AS total_time_ms,
            ROUND(AVG_TIMER_WAIT / 1000000000, 2) AS mean_time_ms,
            ROUND(MIN_TIMER_WAIT / 1000000000, 2) AS min_time_ms,
            ROUND(MAX_TIMER_WAIT / 1000000000, 2) AS max_time_ms,
            SUM_ROWS_EXAMINED AS rows
          FROM performance_schema.events_statements_summary_by_digest
          WHERE DIGEST_TEXT IS NOT NULL
            AND DIGEST_TEXT NOT LIKE '%performance_schema%'
          ORDER BY SUM_TIMER_WAIT DESC
          LIMIT 20`,
          []
        );

        return NextResponse.json({ available: true, queries: result.rows });
      } catch {
        return NextResponse.json({
          available: false,
          message: "performance_schema is not accessible",
          queries: [],
        });
      }
    }
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Slow queries error:", error);
    return NextResponse.json(
      { error: sanitizedError, available: false, queries: [] },
      { status: 500 }
    );
  }
}
