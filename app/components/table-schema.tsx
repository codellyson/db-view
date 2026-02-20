"use client";

import React, { useState } from "react";
import { ColumnInfo } from "@/types";

interface TableSchemaProps {
  columns: ColumnInfo[];
  indexes?: any[];
  constraints?: any[];
}

export const TableSchema: React.FC<TableSchemaProps> = ({
  columns,
  indexes,
  constraints,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mb-8 border-2 border-black dark:border-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-black dark:bg-white hover:bg-white dark:hover:bg-black border-b-2 border-black dark:border-white group"
        aria-expanded={isExpanded}
        aria-controls="schema-table"
        aria-label={isExpanded ? "Collapse table schema" : "Expand table schema"}
      >
        <h3 className="text-base font-bold uppercase text-white dark:text-black group-hover:text-black dark:group-hover:text-white">
          TABLE SCHEMA
        </h3>
        <span className="text-white dark:text-black group-hover:text-black dark:group-hover:text-white font-bold" aria-hidden="true">
          {isExpanded ? "▼" : "▶"}
        </span>
      </button>
      {isExpanded && (
        <div id="schema-table" className="p-0 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-black dark:bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white dark:text-black border-2 border-black dark:border-white font-mono max-w-xs">
                  COLUMN
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white dark:text-black border-2 border-black dark:border-white font-mono max-w-xs">
                  TYPE
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white dark:text-black border-2 border-black dark:border-white font-mono">
                  NULL
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white dark:text-black border-2 border-black dark:border-white font-mono max-w-xs">
                  DEFAULT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-black">
              {columns.map((column, index) => (
                <tr key={index} className="border-2 border-black dark:border-white">
                  <td
                    className="px-4 py-3 text-sm text-black dark:text-white border-2 border-black dark:border-white font-mono max-w-xs"
                    title={column.name}
                  >
                    <div className="truncate flex items-center gap-2">
                      <span className="truncate">{column.name}</span>
                      {column.isPrimaryKey && (
                        <span className="text-xs font-bold uppercase bg-blue-400 text-black px-2 py-1 border-2 border-black dark:border-white flex-shrink-0">
                          PK
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-black dark:text-white border-2 border-black dark:border-white font-mono max-w-xs"
                    title={column.type}
                  >
                    <div className="truncate">{column.type}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-black dark:text-white border-2 border-black dark:border-white font-mono font-bold uppercase">
                    {column.nullable ? "YES" : "NO"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-black dark:text-white border-2 border-black dark:border-white font-mono max-w-xs"
                    title={column.default || "—"}
                  >
                    <div className="truncate">
                      {column.default || <span className="font-bold">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
