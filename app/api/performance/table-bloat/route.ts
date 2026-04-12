import { NextRequest, NextResponse } from "next/server";
import { getSessionProvider } from "@/lib/db";
import { sanitizeError } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    const { provider } = await getSessionProvider();

    const schema = request.nextUrl.searchParams.get("schema") || "public";

    let tables: any[] = [];

    if (provider.type === "postgresql") {
      const result = await provider.query(
        `SELECT
          relname AS table_name,
          n_live_tup AS live_rows,
          n_dead_tup AS dead_rows,
          CASE WHEN n_live_tup > 0
            THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
            ELSE 0
          END AS bloat_ratio,
          pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))) AS total_size,
          pg_size_pretty(pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))) AS table_size,
          pg_size_pretty(pg_indexes_size(quote_ident(schemaname) || '.' || quote_ident(relname))) AS index_size,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = $1
        ORDER BY n_dead_tup DESC`,
        [schema]
      );
      tables = result.rows;
    } else {
      const result = await provider.query(
        `SELECT
          TABLE_NAME AS table_name,
          TABLE_ROWS AS live_rows,
          DATA_FREE AS dead_rows,
          CASE WHEN DATA_LENGTH > 0
            THEN ROUND(100.0 * DATA_FREE / (DATA_LENGTH + DATA_FREE), 1)
            ELSE 0
          END AS bloat_ratio,
          CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2), ' MB') AS total_size,
          CONCAT(ROUND(DATA_LENGTH / 1024 / 1024, 2), ' MB') AS table_size,
          CONCAT(ROUND(INDEX_LENGTH / 1024 / 1024, 2), ' MB') AS index_size,
          NULL AS last_vacuum,
          NULL AS last_autovacuum,
          UPDATE_TIME AS last_analyze,
          NULL AS last_autoanalyze
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY DATA_FREE DESC`,
        [schema]
      );
      tables = result.rows;
    }

    return NextResponse.json({ tables });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Table bloat error:", error);
    return NextResponse.json({ error: sanitizedError, tables: [] }, { status: 500 });
  }
}
