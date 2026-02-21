import { NextRequest, NextResponse } from "next/server";
import { getTables, getTableSchema, getTableRelationships, ensurePool, getPool } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    if (!getPool()) {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get("db-session")?.value;
      await ensurePool(sessionId);
    }

    const schema = request.nextUrl.searchParams.get("schema") || "public";
    const tableNames = await getTables(schema);

    const [schemaResults, relResults] = await Promise.all([
      Promise.allSettled(
        tableNames.map(async (name) => {
          const cols = await getTableSchema(name, schema);
          return {
            name,
            columns: cols.map((col: any) => ({
              name: col.column_name ?? col.name,
              type: col.data_type ?? col.type,
              isPrimaryKey: col.is_primary_key ?? col.isPrimaryKey ?? false,
            })),
          };
        })
      ),
      Promise.allSettled(
        tableNames.map(async (name) => {
          const rels = await getTableRelationships(name, schema);
          return { tableName: name, relationships: rels };
        })
      ),
    ]);

    const tables = schemaResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value);

    const seen = new Set<string>();
    const relationships: any[] = [];

    for (const result of relResults) {
      if (result.status !== "fulfilled") continue;
      const { tableName, relationships: rels } = result.value;
      for (const rel of rels) {
        if (!rel.target_table) continue;
        const key = `${tableName}.${rel.source_column}->${rel.target_table}.${rel.target_column}`;
        if (seen.has(key)) continue;
        seen.add(key);
        relationships.push({
          sourceTable: tableName,
          sourceColumn: rel.source_column,
          targetTable: rel.target_table,
          targetColumn: rel.target_column,
          constraintName: rel.constraint_name,
        });
      }
    }

    return NextResponse.json({ tables, relationships });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);
    return NextResponse.json({ error: sanitizedError }, { status: 500 });
  }
}
