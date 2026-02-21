import React, { useState, useMemo } from 'react';
import { EmptyState } from './empty-state';
import { TableSkeleton } from './skeletons/table-skeleton';

interface DataTableProps {
  columns: string[];
  data: any[];
  isLoading: boolean;
  onSort?: (column: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc' | null;
  visibleColumns?: string[];
  searchQuery?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  isLoading,
  onSort,
  sortColumn,
  sortDirection,
  visibleColumns,
  searchQuery,
}) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const displayColumns = visibleColumns
    ? columns.filter((col) => visibleColumns.includes(col))
    : columns;

  const filteredData = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, columns, searchQuery]);

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No data found"
        description="This table appears to be empty."
      />
    );
  }

  if (filteredData.length === 0) {
    return (
      <EmptyState
        title="No matching rows"
        description="No rows match your search query."
      />
    );
  }

  const getSortIndicator = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') return '\u2191'; // ↑
      if (sortDirection === 'desc') return '\u2193'; // ↓
    }
    return '\u2195'; // ↕
  };

  const getAriaSort = (column: string): 'ascending' | 'descending' | 'none' | undefined => {
    if (!onSort) return undefined;
    if (sortColumn === column) {
      if (sortDirection === 'asc') return 'ascending';
      if (sortDirection === 'desc') return 'descending';
    }
    return 'none';
  };

  const toggleRowExpand = (rowIndex: number) => {
    setExpandedRow(expandedRow === rowIndex ? null : rowIndex);
  };

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[600px] border-2 border-black dark:border-white relative">
      <table className="min-w-full border-collapse">
        <thead className="bg-black dark:bg-white sticky top-0 z-10">
          <tr>
            {displayColumns.map((column) => (
              <th
                key={column}
                scope="col"
                aria-sort={getAriaSort(column)}
                className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-white dark:text-black border-2 border-black dark:border-white font-mono max-w-xs ${
                  onSort ? 'cursor-pointer hover:bg-white/10 dark:hover:bg-black/10' : ''
                } ${sortColumn === column ? 'bg-accent/20' : ''}`}
                onClick={() => onSort?.(column)}
                title={column}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{column}</span>
                  {onSort && (
                    <span className={`flex-shrink-0 ${sortColumn === column ? 'text-accent' : 'text-white/50 dark:text-black/50'}`}>
                      {getSortIndicator(column)}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-black">
          {filteredData.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <tr
                className={`border-2 border-black dark:border-white cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
                  expandedRow === rowIndex ? 'bg-black/5 dark:bg-white/5' : ''
                }`}
                onClick={() => toggleRowExpand(rowIndex)}
              >
                {displayColumns.map((column) => (
                  <td
                    key={column}
                    className="px-6 py-4 text-sm text-black dark:text-white border-2 border-black dark:border-white font-mono max-w-xs"
                    title={row[column] !== null && row[column] !== undefined ? String(row[column]) : 'NULL'}
                  >
                    <div className="truncate">
                      {row[column] !== null && row[column] !== undefined
                        ? String(row[column])
                        : (
                            <span className="text-black dark:text-white font-bold">NULL</span>
                          )}
                    </div>
                  </td>
                ))}
              </tr>
              {expandedRow === rowIndex && (
                <tr className="border-2 border-black dark:border-white">
                  <td colSpan={displayColumns.length} className="p-0">
                    <div className="bg-black/5 dark:bg-white/5 p-4 space-y-2">
                      <div className="text-xs font-bold uppercase font-mono text-black dark:text-white mb-3 border-b-2 border-black dark:border-white pb-2">
                        ROW DETAIL
                      </div>
                      {columns.map((column) => (
                        <div key={column} className="flex gap-4 text-sm font-mono">
                          <span className="font-bold uppercase text-black dark:text-white min-w-[150px] flex-shrink-0">
                            {column}:
                          </span>
                          <span className="text-black dark:text-white break-all whitespace-pre-wrap">
                            {row[column] !== null && row[column] !== undefined
                              ? typeof row[column] === 'object'
                                ? JSON.stringify(row[column], null, 2)
                                : String(row[column])
                              : 'NULL'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
