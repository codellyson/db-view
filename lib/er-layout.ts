export interface ERTable {
  name: string;
  columns: { name: string; type: string; isPrimaryKey: boolean }[];
}

export interface ERRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  constraintName: string;
}

export interface LayoutTable {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: { name: string; type: string; isPrimaryKey: boolean }[];
}

export interface LayoutRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  constraintName: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface LayoutResult {
  tables: LayoutTable[];
  relationships: LayoutRelationship[];
  width: number;
  height: number;
}

const TABLE_WIDTH = 220;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 24;
const H_GAP = 80;
const V_GAP = 60;
const PADDING = 40;

function tableHeight(columnCount: number): number {
  return HEADER_HEIGHT + Math.max(columnCount, 1) * ROW_HEIGHT + 8;
}

export function computeLayout(
  tables: ERTable[],
  relationships: ERRelationship[]
): LayoutResult {
  if (tables.length === 0) {
    return { tables: [], relationships: [], width: 0, height: 0 };
  }

  // Build adjacency for BFS ordering
  const adj = new Map<string, Set<string>>();
  for (const t of tables) adj.set(t.name, new Set());
  for (const r of relationships) {
    adj.get(r.sourceTable)?.add(r.targetTable);
    adj.get(r.targetTable)?.add(r.sourceTable);
  }

  // Sort tables: most connected first for BFS root
  const sorted = [...tables].sort(
    (a, b) => (adj.get(b.name)?.size || 0) - (adj.get(a.name)?.size || 0)
  );

  // BFS ordering to place connected tables nearby
  const ordered: string[] = [];
  const visited = new Set<string>();

  for (const root of sorted) {
    if (visited.has(root.name)) continue;
    const queue = [root.name];
    visited.add(root.name);
    while (queue.length > 0) {
      const current = queue.shift()!;
      ordered.push(current);
      const neighbors = adj.get(current) || new Set();
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }

  // Grid layout
  const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  const tableMap = new Map<string, ERTable>();
  for (const t of tables) tableMap.set(t.name, t);

  const positioned: LayoutTable[] = [];
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();

  // Calculate column heights to handle variable row heights
  const colHeights: number[] = new Array(cols).fill(PADDING);

  for (let i = 0; i < ordered.length; i++) {
    const name = ordered[i];
    const table = tableMap.get(name);
    if (!table) continue;

    const col = i % cols;
    const x = PADDING + col * (TABLE_WIDTH + H_GAP);
    const y = colHeights[col];
    const h = tableHeight(table.columns.length);

    colHeights[col] = y + h + V_GAP;

    const lt: LayoutTable = {
      name,
      x,
      y,
      width: TABLE_WIDTH,
      height: h,
      columns: table.columns,
    };
    positioned.push(lt);
    positions.set(name, { x, y, width: TABLE_WIDTH, height: h });
  }

  // Calculate relationship connection points
  const layoutRels: LayoutRelationship[] = [];
  for (const r of relationships) {
    const src = positions.get(r.sourceTable);
    const tgt = positions.get(r.targetTable);
    if (!src || !tgt) continue;

    const srcTable = tableMap.get(r.sourceTable);
    const tgtTable = tableMap.get(r.targetTable);
    if (!srcTable || !tgtTable) continue;

    const srcColIdx = srcTable.columns.findIndex((c) => c.name === r.sourceColumn);
    const tgtColIdx = tgtTable.columns.findIndex((c) => c.name === r.targetColumn);

    const srcRowY = src.y + HEADER_HEIGHT + (srcColIdx >= 0 ? srcColIdx : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;
    const tgtRowY = tgt.y + HEADER_HEIGHT + (tgtColIdx >= 0 ? tgtColIdx : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;

    // Connect from right side of source to left side of target, or vice versa
    let fromX: number, toX: number;
    if (src.x + src.width < tgt.x) {
      fromX = src.x + src.width;
      toX = tgt.x;
    } else if (tgt.x + tgt.width < src.x) {
      fromX = src.x;
      toX = tgt.x + tgt.width;
    } else {
      // Overlapping columns — use right sides
      fromX = src.x + src.width;
      toX = tgt.x + tgt.width;
    }

    layoutRels.push({
      ...r,
      from: { x: fromX, y: srcRowY },
      to: { x: toX, y: tgtRowY },
    });
  }

  const maxX = Math.max(...positioned.map((t) => t.x + t.width)) + PADDING;
  const maxY = Math.max(...colHeights) + PADDING;

  return {
    tables: positioned,
    relationships: layoutRels,
    width: maxX,
    height: maxY,
  };
}
