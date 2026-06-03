"use client";

import React, { useMemo } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { computeQueryDiff } from "@/lib/diff-utils";
import type { PinnedResult } from "@/types";

interface QueryDiffViewProps {
  pinned: PinnedResult;
  current: PinnedResult;
  onClose: () => void;
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export const QueryDiffView: React.FC<QueryDiffViewProps> = ({
  pinned,
  current,
  onClose,
}) => {
  const diff = useMemo(
    () =>
      computeQueryDiff(
        pinned.columns,
        pinned.data,
        current.columns,
        current.data
      ),
    [pinned.columns, pinned.data, current.columns, current.data]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info">{diff.summary.matchedRows} matched</Badge>
          {diff.summary.changedCells > 0 && (
            <Badge variant="warning">{diff.summary.changedCells} changed</Badge>
          )}
          {diff.summary.addedRows > 0 && (
            <Badge variant="success">+{diff.summary.addedRows} added</Badge>
          )}
          {diff.summary.removedRows > 0 && (
            <Badge variant="danger">-{diff.summary.removedRows} removed</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close Diff
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Pinned */}
        <div>
          <div className="text-xs font-medium text-secondary mb-2 truncate" title={pinned.query}>
            Pinned: {pinned.query.slice(0, 60)}{pinned.query.length > 60 ? "..." : ""}
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-border rounded-lg">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-muted border-b border-border w-8">#</th>
                  {diff.allColumns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-1.5 text-left font-medium text-secondary border-b border-border"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diff.rows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`border-b border-border ${
                      row.status === "removed"
                        ? "bg-danger/5"
                        : row.status === "added"
                        ? "bg-bg-secondary/30"
                        : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 text-muted font-mono">{row.rowIndex + 1}</td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.column}
                        className={`px-3 py-1.5 font-mono ${
                          row.status === "removed"
                            ? "text-danger/70"
                            : cell.changed && row.status === "matched"
                            ? "bg-danger/10 text-primary"
                            : row.status === "added"
                            ? "text-muted"
                            : "text-primary"
                        }`}
                      >
                        {row.status === "added" ? (
                          <span className="text-muted italic">--</span>
                        ) : (
                          <span className="truncate block max-w-[200px]" title={formatCell(cell.leftValue)}>
                            {cell.leftValue === null || cell.leftValue === undefined ? (
                              <span className="text-muted italic">NULL</span>
                            ) : (
                              formatCell(cell.leftValue)
                            )}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Current */}
        <div>
          <div className="text-xs font-medium text-secondary mb-2 truncate" title={current.query}>
            Current: {current.query.slice(0, 60)}{current.query.length > 60 ? "..." : ""}
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-border rounded-lg">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-muted border-b border-border w-8">#</th>
                  {diff.allColumns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-1.5 text-left font-medium text-secondary border-b border-border"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diff.rows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`border-b border-border ${
                      row.status === "added"
                        ? "bg-success/5"
                        : row.status === "removed"
                        ? "bg-bg-secondary/30"
                        : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 text-muted font-mono">{row.rowIndex + 1}</td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.column}
                        className={`px-3 py-1.5 font-mono ${
                          row.status === "added"
                            ? "text-success"
                            : cell.changed && row.status === "matched"
                            ? "bg-success/10 text-primary"
                            : row.status === "removed"
                            ? "text-muted"
                            : "text-primary"
                        }`}
                      >
                        {row.status === "removed" ? (
                          <span className="text-muted italic">--</span>
                        ) : (
                          <span className="truncate block max-w-[200px]" title={formatCell(cell.rightValue)}>
                            {cell.rightValue === null || cell.rightValue === undefined ? (
                              <span className="text-muted italic">NULL</span>
                            ) : (
                              formatCell(cell.rightValue)
                            )}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
