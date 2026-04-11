'use client';

import React, { useState, useCallback } from 'react';
import { EditableCell } from './editable-cell';
import { ColumnInfo } from '@/types';

interface MobileRowCardProps {
  row: any;
  rowIndex: number;
  columns: string[];
  primaryKeys: string[];
  previewColumns: string[];
  columnTypes: Record<string, string>;
  columnSchema: ColumnInfo[];
  canEdit: boolean;
  canDelete: boolean;
  isColumnEditable?: (column: string) => boolean;
  onCellUpdate?: (rowPks: Record<string, any>, column: string, newValue: any) => void;
  onRowDelete?: (rowPks: Record<string, any>) => void;
  getRowPrimaryKeys: (row: any) => Record<string, any>;
}

export const MobileRowCard: React.FC<MobileRowCardProps> = ({
  row,
  rowIndex,
  columns,
  primaryKeys,
  previewColumns,
  columnTypes,
  columnSchema,
  canEdit,
  canDelete,
  isColumnEditable,
  onCellUpdate,
  onRowDelete,
  getRowPrimaryKeys,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const truncateValue = (val: any, maxLen = 40): string => {
    const str = formatValue(val);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '...';
  };

  const isNull = (val: any) => val === null || val === undefined;

  const handleSave = useCallback((column: string, newValue: any) => {
    onCellUpdate?.(getRowPrimaryKeys(row), column, newValue);
    setEditingField(null);
  }, [row, onCellUpdate, getRowPrimaryKeys]);

  // Get a display label — first PK value or first column value
  const pkCol = primaryKeys[0];
  const pkValue = pkCol ? row[pkCol] : null;
  const detailColumns = columns.filter((c) => !primaryKeys.includes(c) || isExpanded);

  return (
    <div className={`border border-border rounded-lg transition-colors ${isExpanded ? 'bg-bg-secondary/20' : 'bg-bg'}`}>
      {/* Card header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left px-3 py-2.5 flex items-start gap-3"
      >
        {/* PK badge */}
        {pkCol && (
          <div className="flex-shrink-0 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">
              {pkCol}
            </span>
          </div>
        )}

        {/* Preview content */}
        <div className="flex-1 min-w-0">
          {/* PK value as title */}
          <div className="text-sm font-medium text-primary truncate font-mono">
            {pkValue !== null && pkValue !== undefined ? truncateValue(pkValue, 50) : (
              <span className="text-muted italic">NULL</span>
            )}
          </div>
          {/* Preview fields */}
          {!isExpanded && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {previewColumns.slice(0, 3).map((col) => (
                <span key={col} className="text-xs text-muted truncate max-w-[140px]">
                  <span className="text-secondary">{col}:</span>{' '}
                  <span className={isNull(row[col]) ? 'italic' : 'font-mono'}>
                    {truncateValue(row[col], 24)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-muted flex-shrink-0 mt-0.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-0.5">
          <div className="border-t border-border pt-2 space-y-1">
            {columns.map((column) => {
              const isPk = primaryKeys.includes(column);
              const isEditable = canEdit && !isPk && (isColumnEditable ? isColumnEditable(column) : true);
              const value = row[column];

              return (
                <div key={column} className="flex items-start gap-2 py-1 group">
                  {/* Column label */}
                  <div className="flex-shrink-0 w-[100px]">
                    <span className="text-[11px] font-medium text-secondary leading-tight block truncate" title={column}>
                      {column}
                    </span>
                    {columnTypes[column] && (
                      <span className="text-[9px] text-muted font-mono block truncate">{columnTypes[column]}</span>
                    )}
                    {isPk && (
                      <span className="text-[8px] font-medium bg-accent/10 text-accent px-1 rounded mt-0.5 inline-block">PK</span>
                    )}
                  </div>

                  {/* Value */}
                  <div className="flex-1 min-w-0">
                    {editingField === column && isEditable ? (
                      <EditableCell
                        value={value}
                        column={column}
                        columnType={columnTypes[column]}
                        isEditing={true}
                        onStartEdit={() => {}}
                        onSave={handleSave}
                        onCancel={() => setEditingField(null)}
                      />
                    ) : (
                      <div
                        className={`text-xs font-mono break-all whitespace-pre-wrap leading-relaxed ${
                          isNull(value) ? 'text-muted italic' : 'text-primary'
                        } ${isEditable ? 'active:bg-accent/5 rounded px-1 -mx-1' : ''}`}
                        onClick={(e) => {
                          if (isEditable) {
                            e.stopPropagation();
                            setEditingField(column);
                          }
                        }}
                      >
                        {isNull(value) ? 'NULL' : (
                          typeof value === 'object'
                            ? JSON.stringify(value, null, 2)
                            : String(value)
                        )}
                      </div>
                    )}
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(formatValue(value));
                    }}
                    className="flex-shrink-0 p-1 text-muted/0 group-hover:text-muted active:text-accent transition-colors"
                    aria-label={`Copy ${column} value`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(JSON.stringify(row, null, 2));
              }}
              className="text-[11px] text-secondary hover:text-primary px-2 py-1 rounded hover:bg-bg-secondary transition-colors"
            >
              Copy JSON
            </button>
            {canDelete && onRowDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRowDelete(getRowPrimaryKeys(row));
                }}
                className="text-[11px] text-danger hover:text-danger/80 px-2 py-1 rounded hover:bg-danger/5 transition-colors ml-auto"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
