export interface DiffCell {
  column: string;
  leftValue: any;
  rightValue: any;
  changed: boolean;
}

export interface DiffRow {
  rowIndex: number;
  cells: DiffCell[];
  status: "matched" | "added" | "removed";
}

export interface DiffSummary {
  totalRows: number;
  matchedRows: number;
  addedRows: number;
  removedRows: number;
  changedCells: number;
}

export interface DiffResult {
  rows: DiffRow[];
  summary: DiffSummary;
  allColumns: string[];
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "__NULL__";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function computeQueryDiff(
  leftColumns: string[],
  leftData: any[],
  rightColumns: string[],
  rightData: any[]
): DiffResult {
  const allColumns = Array.from(
    new Set([...leftColumns, ...rightColumns])
  );

  const maxLen = Math.max(leftData.length, rightData.length);
  const minLen = Math.min(leftData.length, rightData.length);
  const rows: DiffRow[] = [];
  let matchedRows = 0;
  let addedRows = 0;
  let removedRows = 0;
  let changedCells = 0;

  for (let i = 0; i < maxLen; i++) {
    if (i < minLen) {
      const leftRow = leftData[i];
      const rightRow = rightData[i];
      const cells: DiffCell[] = allColumns.map((col) => {
        const lv = leftRow[col];
        const rv = rightRow[col];
        const changed = formatValue(lv) !== formatValue(rv);
        if (changed) changedCells++;
        return { column: col, leftValue: lv, rightValue: rv, changed };
      });
      rows.push({ rowIndex: i, cells, status: "matched" });
      matchedRows++;
    } else if (i < leftData.length) {
      const leftRow = leftData[i];
      const cells: DiffCell[] = allColumns.map((col) => ({
        column: col,
        leftValue: leftRow[col],
        rightValue: undefined,
        changed: true,
      }));
      rows.push({ rowIndex: i, cells, status: "removed" });
      removedRows++;
    } else {
      const rightRow = rightData[i];
      const cells: DiffCell[] = allColumns.map((col) => ({
        column: col,
        leftValue: undefined,
        rightValue: rightRow[col],
        changed: true,
      }));
      rows.push({ rowIndex: i, cells, status: "added" });
      addedRows++;
    }
  }

  return {
    rows,
    summary: {
      totalRows: maxLen,
      matchedRows,
      addedRows,
      removedRows,
      changedCells,
    },
    allColumns,
  };
}
