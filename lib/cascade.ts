import {
  DatabaseProvider,
  DeleteRule,
  IncomingForeignKey,
} from "./db-provider";
import {
  Dialect,
  escapeIdentifier,
  placeholder,
  validateIdentifier,
} from "./mutation";

export interface CascadeNodeRequest {
  schema: string;
  table: string;
  pks: Array<Record<string, any>>;
}

export interface CascadeBucketEntry {
  schema: string;
  table: string;
  fkConstraint: string;
  fkColumns: string[];
  parentSchema: string;
  parentTable: string;
  parentColumns: string[];
  deleteRule: DeleteRule;
  count: number;
  truncated: boolean;
  sampleRows?: Array<Record<string, any>>;
}

export interface CascadeResult {
  cascade: CascadeBucketEntry[];
  setNull: CascadeBucketEntry[];
  blocked: CascadeBucketEntry[];
  truncated: boolean;
  elapsedMs: number;
  warnings: string[];
}

export interface CascadeOptions {
  timeBudgetMs?: number;
  maxDepth?: number;
  maxPerTable?: number;
}

const DEFAULTS: Required<CascadeOptions> = {
  timeBudgetMs: 3000,
  maxDepth: 6,
  maxPerTable: 1000,
};

export async function previewCascade({
  provider,
  deletes,
  options,
}: {
  provider: DatabaseProvider;
  deletes: CascadeNodeRequest[];
  options?: CascadeOptions;
}): Promise<CascadeResult> {
  const opts = { ...DEFAULTS, ...options };
  const dialect = provider.type;
  const start = Date.now();

  const fkCache = new Map<string, IncomingForeignKey[]>();
  const pkCache = new Map<string, string[]>();
  const visited = new Set<string>();

  const cascade: CascadeBucketEntry[] = [];
  const setNull: CascadeBucketEntry[] = [];
  const blocked: CascadeBucketEntry[] = [];
  const warnings: string[] = [];
  let truncatedAny = false;

  type Node = {
    schema: string;
    table: string;
    pks: Array<Record<string, any>>;
    depth: number;
  };

  const queue: Node[] = deletes
    .filter((d) => d.pks.length > 0)
    .map((d) => ({ schema: d.schema, table: d.table, pks: d.pks, depth: 0 }));

  while (queue.length > 0) {
    if (Date.now() - start > opts.timeBudgetMs) {
      truncatedAny = true;
      warnings.push("Cascade preview hit the time budget; results may be incomplete.");
      break;
    }

    const node = queue.shift()!;
    if (node.depth >= opts.maxDepth) {
      truncatedAny = true;
      warnings.push(
        `Reached max depth (${opts.maxDepth}) at ${node.schema}.${node.table}; deeper cascades not explored.`
      );
      continue;
    }

    const fresh: Array<Record<string, any>> = [];
    for (const pk of node.pks) {
      const k = rowKey(node.schema, node.table, pk);
      if (visited.has(k)) continue;
      visited.add(k);
      fresh.push(pk);
    }
    if (fresh.length === 0) continue;

    const fks = await getCachedFks(provider, fkCache, node.schema, node.table);
    if (fks.length === 0) continue;

    const byConstraint = new Map<string, IncomingForeignKey[]>();
    for (const fk of fks) {
      const key = `${fk.childSchema}.${fk.childTable}.${fk.constraintName}`;
      const list = byConstraint.get(key) ?? [];
      list.push(fk);
      byConstraint.set(key, list);
    }

    for (const group of byConstraint.values()) {
      const first = group[0];
      const childCols = group.map((g) => g.childColumn);
      const parentCols = group.map((g) => g.parentColumn);

      const tuples: any[][] = [];
      for (const pk of fresh) {
        const tuple = parentCols.map((c) => pk[c]);
        if (tuple.some((v) => v === undefined || v === null)) continue;
        tuples.push(tuple);
      }
      if (tuples.length === 0) continue;

      const { sql: countSql, params: countParams } = buildCountQuery(
        first.childSchema,
        first.childTable,
        childCols,
        tuples,
        dialect
      );

      let count = 0;
      try {
        const r = await provider.query(countSql, countParams);
        count = extractCount(r.rows[0]);
      } catch (err: any) {
        warnings.push(
          `Count query failed for ${first.childSchema}.${first.childTable}: ${err.message ?? String(err)}`
        );
        continue;
      }

      if (count === 0) continue;

      const entry: CascadeBucketEntry = {
        schema: first.childSchema,
        table: first.childTable,
        fkConstraint: first.constraintName,
        fkColumns: childCols,
        parentSchema: node.schema,
        parentTable: node.table,
        parentColumns: parentCols,
        deleteRule: first.deleteRule,
        count,
        truncated: false,
      };

      if (first.deleteRule === "RESTRICT" || first.deleteRule === "NO ACTION") {
        blocked.push(entry);
        continue;
      }
      if (first.deleteRule === "SET NULL" || first.deleteRule === "SET DEFAULT") {
        setNull.push(entry);
        continue;
      }

      cascade.push(entry);

      const childPkCols = await getCachedPks(
        provider,
        pkCache,
        first.childSchema,
        first.childTable
      );
      if (childPkCols.length === 0) {
        warnings.push(
          `Cannot follow cascade into ${first.childSchema}.${first.childTable}: no primary key detected.`
        );
        continue;
      }

      const { sql: pkSql, params: pkParams } = buildSelectPksQuery(
        first.childSchema,
        first.childTable,
        childCols,
        childPkCols,
        tuples,
        opts.maxPerTable,
        dialect
      );

      let childRows: any[] = [];
      try {
        const r = await provider.query(pkSql, pkParams);
        childRows = r.rows;
      } catch (err: any) {
        warnings.push(
          `Child PK fetch failed for ${first.childSchema}.${first.childTable}: ${err.message ?? String(err)}`
        );
        continue;
      }

      if (count > childRows.length) {
        entry.truncated = true;
        truncatedAny = true;
      }

      const childPks = childRows.map((row) => {
        const obj: Record<string, any> = {};
        for (const c of childPkCols) obj[c] = row[c];
        return obj;
      });
      if (childPks.length > 0) {
        queue.push({
          schema: first.childSchema,
          table: first.childTable,
          pks: childPks,
          depth: node.depth + 1,
        });
      }
    }
  }

  return {
    cascade,
    setNull,
    blocked,
    truncated: truncatedAny,
    elapsedMs: Date.now() - start,
    warnings,
  };
}

function rowKey(schema: string, table: string, pks: Record<string, any>): string {
  const sorted = Object.keys(pks).sort();
  return `${schema}.${table}:` + JSON.stringify(sorted.map((k) => [k, pks[k]]));
}

async function getCachedFks(
  provider: DatabaseProvider,
  cache: Map<string, IncomingForeignKey[]>,
  schema: string,
  table: string
): Promise<IncomingForeignKey[]> {
  const key = `${schema}.${table}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const fks = await provider.getIncomingForeignKeys(table, schema);
  cache.set(key, fks);
  return fks;
}

async function getCachedPks(
  provider: DatabaseProvider,
  cache: Map<string, string[]>,
  schema: string,
  table: string
): Promise<string[]> {
  const key = `${schema}.${table}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const cols = (await provider.getTableSchema(table, schema)) as Array<{
    column_name: string;
    is_primary_key: boolean;
  }>;
  const pks = cols.filter((c) => c.is_primary_key).map((c) => c.column_name);
  cache.set(key, pks);
  return pks;
}

function extractCount(row: any): number {
  if (!row) return 0;
  const direct = row.count ?? row.COUNT ?? row["COUNT(*)"] ?? row["count(*)"];
  if (direct !== undefined && direct !== null) return Number(direct);
  const first = Object.values(row)[0];
  return Number(first ?? 0);
}

function buildWhereClause(
  childCols: string[],
  tuples: any[][],
  dialect: Dialect,
  startIndex: number
): { whereClause: string; params: any[]; nextIndex: number } {
  for (const c of childCols) validateIdentifier(c);
  const esc = (n: string) => escapeIdentifier(n, dialect);
  const params: any[] = [];
  let i = startIndex;

  if (childCols.length === 1) {
    const col = esc(childCols[0]);
    const phs: string[] = [];
    for (const t of tuples) {
      phs.push(placeholder(i++, dialect));
      params.push(t[0]);
    }
    return { whereClause: `${col} IN (${phs.join(", ")})`, params, nextIndex: i };
  }

  const colsList = childCols.map(esc).join(", ");
  const tupleStrs: string[] = [];
  for (const t of tuples) {
    const phs: string[] = [];
    for (const v of t) {
      phs.push(placeholder(i++, dialect));
      params.push(v);
    }
    tupleStrs.push(`(${phs.join(", ")})`);
  }
  return {
    whereClause: `(${colsList}) IN (${tupleStrs.join(", ")})`,
    params,
    nextIndex: i,
  };
}

function buildCountQuery(
  schema: string,
  table: string,
  childCols: string[],
  tuples: any[][],
  dialect: Dialect
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);
  const esc = (n: string) => escapeIdentifier(n, dialect);
  const qt = dialect === "sqlite" ? esc(table) : `${esc(schema)}.${esc(table)}`;
  const { whereClause, params } = buildWhereClause(childCols, tuples, dialect, 1);
  return {
    sql: `SELECT COUNT(*) AS count FROM ${qt} WHERE ${whereClause}`,
    params,
  };
}

function buildSelectPksQuery(
  schema: string,
  table: string,
  childCols: string[],
  pkCols: string[],
  tuples: any[][],
  limit: number,
  dialect: Dialect
): { sql: string; params: any[] } {
  validateIdentifier(schema);
  validateIdentifier(table);
  for (const c of pkCols) validateIdentifier(c);
  const esc = (n: string) => escapeIdentifier(n, dialect);
  const qt = dialect === "sqlite" ? esc(table) : `${esc(schema)}.${esc(table)}`;
  const { whereClause, params } = buildWhereClause(childCols, tuples, dialect, 1);
  const cols = pkCols.map(esc).join(", ");
  const safeLimit = Math.max(1, Math.floor(limit));
  return {
    sql: `SELECT ${cols} FROM ${qt} WHERE ${whereClause} LIMIT ${safeLimit}`,
    params,
  };
}
