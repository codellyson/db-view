import React from 'react';
import { Spinner } from './ui/spinner';
import { EmptyState } from './empty-state';

interface DataTableProps {
  columns: string[];
  data: any[];
  isLoading: boolean;
  onSort?: (column: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  isLoading,
  onSort,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No data found"
        description="This table appears to be empty."
      />
    );
  }

  return (
    <div className="overflow-x-auto border-2 border-black">
      <table className="min-w-full border-collapse">
        <thead className="bg-black">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-white border-2 border-black cursor-pointer font-mono max-w-xs"
                onClick={() => onSort?.(column)}
                title={column}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{column}</span>
                  {onSort && (
                    <span className="text-white flex-shrink-0">↕</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-2 border-black"
            >
              {columns.map((column) => (
                <td
                  key={column}
                  className="px-6 py-4 text-sm text-black border-2 border-black font-mono max-w-xs"
                  title={row[column] !== null && row[column] !== undefined ? String(row[column]) : 'NULL'}
                >
                  <div className="truncate">
                    {row[column] !== null && row[column] !== undefined
                      ? String(row[column])
                      : (
                          <span className="text-black font-bold">NULL</span>
                        )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

