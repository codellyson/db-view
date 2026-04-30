import { NextRequest, NextResponse } from "next/server";
import { getTableData, getSessionProvider, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";
import { buildFilterSql, type Filter } from "@/lib/filters";
import { escapeIdentifier, placeholder, validateIdentifier } from "@/lib/mutation";

function parseFilters(raw: string | null): Filter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Filter[];
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
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

    const searchParams = request.nextUrl.searchParams;
    const rawLimit = parseInt(searchParams.get("limit") || "100", 10);
    const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 100 : rawLimit, 1), 1000);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);
    const sortColumn = searchParams.get("sortColumn") || undefined;
    const sortDir = searchParams.get("sortDirection");
    const sortDirection = sortDir === "asc" || sortDir === "desc" ? sortDir : undefined;
    const schema = searchParams.get("schema") || "public";
    const filters = parseFilters(searchParams.get("filters"));

    if (filters.length === 0) {
      const { rows, total, countIsEstimate } = await getTableData(
        name,
        limit,
        offset,
        sortColumn,
        sortDirection,
        schema
      );
      return NextResponse.json({ rows, total, limit, offset, countIsEstimate });
    }

    // Filtered path: build a custom SELECT and COUNT bypassing the
    // per-provider getTableData. Counts are exact (no estimate) since
    // pg_class.reltuples doesn't apply to filtered scans.
    validateIdentifier(name);
    validateIdentifier(schema);
    const { provider } = await getSessionProvider();
    const dialect = provider.type;
    const esc = (n: string) => escapeIdentifier(n, dialect);
    const qualified = dialect === "sqlite" ? esc(name) : `${esc(schema)}.${esc(name)}`;
    const { whereClause, params: filterParams } = buildFilterSql(filters, dialect);

    let dataSql = `SELECT * FROM ${qualified} ${whereClause}`;
    if (sortColumn && sortDirection) {
      validateIdentifier(sortColumn);
      dataSql += ` ORDER BY ${esc(sortColumn)} ${sortDirection === "desc" ? "DESC" : "ASC"}`;
    }
    // limit/offset bound directly — they're already validated as integers.
    dataSql += ` LIMIT ${limit} OFFSET ${offset}`;

    const countSql = `SELECT COUNT(*) AS count FROM ${qualified} ${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
      provider.query(dataSql, filterParams),
      provider.query(countSql, filterParams),
    ]);

    const total = parseInt(
      String(countResult.rows[0]?.count ?? countResult.rows[0]?.COUNT ?? 0),
      10
    );

    return NextResponse.json({
      rows: dataResult.rows,
      total,
      limit,
      offset,
      countIsEstimate: false,
    });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    console.error("Table data fetch error:", error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
