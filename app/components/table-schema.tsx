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
    <div className="mb-8 border-2 border-black">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-black hover:bg-white border-b-2 border-black group"
      >
        <h3 className="text-base font-bold uppercase text-white group-hover:text-black">
          TABLE SCHEMA
        </h3>
        <span className="text-white group-hover:text-black font-bold">
          {isExpanded ? "▼" : "▶"}
        </span>
      </button>
      {isExpanded && (
        <div className="p-0 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-black">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white border-2 border-black font-mono max-w-xs">
                  COLUMN
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white border-2 border-black font-mono max-w-xs">
                  TYPE
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white border-2 border-black font-mono">
                  NULL
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-white border-2 border-black font-mono max-w-xs">
                  DEFAULT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {columns.map((column, index) => (
                <tr key={index} className="border-2 border-black">
                  <td
                    className="px-4 py-3 text-sm text-black border-2 border-black font-mono max-w-xs"
                    title={column.name}
                  >
                    <div className="truncate flex items-center gap-2">
                      <span className="truncate">{column.name}</span>
                      {column.isPrimaryKey && (
                        <span className="text-xs font-bold uppercase bg-blue-400 text-black px-2 py-1 border-2 border-black flex-shrink-0">
                          PK
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-black border-2 border-black font-mono max-w-xs"
                    title={column.type}
                  >
                    <div className="truncate">{column.type}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-black border-2 border-black font-mono font-bold uppercase">
                    {column.nullable ? "YES" : "NO"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-black border-2 border-black font-mono max-w-xs"
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
