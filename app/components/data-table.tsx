import React, { useState, useMemo, useCallback } from 'react';
import { EmptyState } from './empty-state';
import { TableSkeleton } from './skeletons/table-skeleton';
import { EditableCell } from './editable-cell';
import { FormattedCell } from './formatted-cell';
import { ColumnInfo } from '@/types';
import type { ColumnFormatter } from '@/lib/plugin-types';
import { applyFormatter } from '@/lib/formatter-presets';

interface DataTableProps {
  columns: string[];
  data: any[];
  isLoading: boolean;
  onSort?: (column: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc' | null;
  visibleColumns?: string[];
  searchQuery?: string;
  primaryKeys?: string[];
  columnSchema?: ColumnInfo[];
  onCellUpdate?: (rowPks: Record<string, any>, column: string, newValue: any) => void;
  onRowDelete?: (rowPks: Record<string, any>) => void;
  readOnlyMode?: boolean;
  columnTypes?: Record<string, string>;
  activeFormatters?: ColumnFormatter[];
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
  primaryKeys = [],
  columnSchema = [],
  onCellUpdate,
  onRowDelete,
  readOnlyMode = false,
  columnTypes = {},
  activeFormatters = [],
}) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const canEdit = !readOnlyMode && primaryKeys.length > 0 && !!onCellUpdate;
  const canDelete = !readOnlyMode && primaryKeys.length > 0 && !!onRowDelete;

  const findFormatter = useCallback(
    (column: string): ColumnFormatter | undefined => {
      if (activeFormatters.length === 0) return undefined;
      const colType = (columnTypes[column] || '').toLowerCase();
      return activeFormatters.find((f) => {
        const val = f.matcher.value.toLowerCase();
        switch (f.matcher.type) {
          case 'data-type':
            return colType.startsWith(val);
          case 'column-name':
            return column.toLowerCase() === val;
          case 'column-name-pattern':
            try {
              return new RegExp(f.matcher.value, 'i').test(column);
            } catch { return false; }
          default:
            return false;
        }
      });
    },
    [activeFormatters, columnTypes]
  );

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

  const getRowPrimaryKeys = useCallback(
    (row: any): Record<string, any> => {
      const pks: Record<string, any> = {};
      for (const pk of primaryKeys) {
        pks[pk] = row[pk];
      }
      return pks;
    },
    [primaryKeys]
  );

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
    if (editingCell) return;
    setExpandedRow(expandedRow === rowIndex ? null : rowIndex);
  };

  const handleCellSave = (row: any, column: string, newValue: any) => {
    const oldValue = row[column];
    const normalizedOld = oldValue === null || oldValue === undefined ? null : String(oldValue);
    const normalizedNew = newValue === null ? null : String(newValue);

    if (normalizedOld !== normalizedNew) {
      onCellUpdate?.(getRowPrimaryKeys(row), column, newValue);
    }
    setEditingCell(null);
  };

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-border rounded-lg relative">
      {!readOnlyMode && primaryKeys.length === 0 && columnSchema.length > 0 && (
        <div className="px-4 py-2 bg-warning/10 text-xs text-warning border-b border-border">
          Editing disabled -- no primary key detected
        </div>
      )}
      <table className="min-w-full border-collapse">
        <thead className="bg-bg-secondary sticky top-0 z-10">
          <tr>
            {canDelete && (
              <th className="w-10 px-2 py-2 text-xs font-medium text-muted border-b border-border" />
            )}
            {displayColumns.map((column) => (
              <th
                key={column}
                scope="col"
                aria-sort={getAriaSort(column)}
                className={`px-4 py-2 text-left text-xs font-medium text-secondary border-b border-border max-w-xs ${
                  onSort ? 'cursor-pointer hover:bg-bg-secondary/80' : ''
                } ${sortColumn === column ? 'text-accent' : ''}`}
                onClick={() => onSort?.(column)}
                title={column}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{column}</span>
                  {primaryKeys.includes(column) && (
                    <span className="text-accent text-[10px] font-medium bg-accent/10 px-1 rounded flex-shrink-0">PK</span>
                  )}
                  {onSort && (
                    <span className={`flex-shrink-0 text-[11px] ${sortColumn === column ? 'text-accent' : 'text-muted'}`}>
                      {getSortIndicator(column)}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-bg">
          {filteredData.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <tr
                className={`border-b border-border cursor-pointer hover:bg-bg-secondary/50 even:bg-bg-secondary/50 ${
                  expandedRow === rowIndex ? 'bg-bg-secondary/70' : ''
                }`}
                onClick={() => toggleRowExpand(rowIndex)}
                onMouseEnter={() => setHoveredRow(rowIndex)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {canDelete && (
                  <td className="px-2 py-2 text-center">
                    {hoveredRow === rowIndex && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowDelete?.(getRowPrimaryKeys(row));
                        }}
                        className="text-danger hover:text-danger/80 text-xs"
                        title="Delete row"
                      >
                        X
                      </button>
                    )}
                  </td>
                )}
                {displayColumns.map((column) => (
                  <td
                    key={column}
                    className="px-4 py-2 text-sm text-primary font-mono max-w-xs"
                    onClick={(e) => {
                      if (editingCell?.row === rowIndex && editingCell?.col === column) {
                        e.stopPropagation();
                      }
                    }}
                  >
                    {canEdit && !primaryKeys.includes(column) ? (
                      <EditableCell
                        value={row[column]}
                        column={column}
                        isEditing={editingCell?.row === rowIndex && editingCell?.col === column}
                        onStartEdit={() => {
                          setEditingCell({ row: rowIndex, col: column });
                          setExpandedRow(null);
                        }}
                        onSave={(col, newValue) => handleCellSave(row, col, newValue)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (() => {
                      const formatter = findFormatter(column);
                      if (formatter) {
                        const formatted = applyFormatter(row[column], formatter.preset);
                        return <FormattedCell formatted={formatted} rawValue={row[column]} />;
                      }
                      return (
                        <div
                          className="truncate"
                          title={row[column] !== null && row[column] !== undefined ? String(row[column]) : 'NULL'}
                        >
                          {row[column] !== null && row[column] !== undefined
                            ? String(row[column])
                            : (
                                <span className="text-muted italic">NULL</span>
                              )}
                        </div>
                      );
                    })()}
                  </td>
                ))}
              </tr>
              {expandedRow === rowIndex && (
                <tr className="border-b border-border">
                  <td colSpan={displayColumns.length + (canDelete ? 1 : 0)} className="p-0">
                    <div className="bg-bg-secondary/40 p-4 space-y-1.5">
                      <div className="text-xs font-medium text-secondary mb-3 border-b border-border pb-2">
                        Row detail
                      </div>
                      {columns.map((column) => (
                        <div key={column} className="flex gap-4 text-sm">
                          <span className="font-medium text-secondary min-w-[150px] flex-shrink-0">
                            {column}:
                          </span>
                          <span className="text-primary font-mono break-all whitespace-pre-wrap">
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
