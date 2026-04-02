'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EmptyState } from './empty-state';
import { TableSkeleton } from './skeletons/table-skeleton';
import { EditableCell } from './editable-cell';
import { FormattedCell } from './formatted-cell';
import { ColumnInfo } from '@/types';
import type { ColumnFormatter } from '@/lib/plugin-types';
import { applyFormatter } from '@/lib/formatter-presets';
import { ContextMenu, useContextMenu, type ContextMenuEntry } from './ui/context-menu';
import { MobileRowCard } from './mobile-row-card';
import { ValuePanel } from './value-panel';
import { useIsMobile } from '../hooks/use-media-query';

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

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const MIN_COL_WIDTH = 80;
const DEFAULT_COL_WIDTH = 180;
const MAX_COL_WIDTH = 600;

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
  const isMobile = useIsMobile();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string; value: any } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [frozenColumn, setFrozenColumn] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragColumnRef = useRef<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const { menu: contextMenu, show: showContextMenu, close: closeContextMenu } = useContextMenu();

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

  const baseColumns = visibleColumns
    ? columns.filter((col) => visibleColumns.includes(col))
    : columns;

  const displayColumns = useMemo(() => {
    if (!columnOrder) return baseColumns;
    // Reorder based on columnOrder, keeping any new columns at the end
    const ordered = columnOrder.filter((col) => baseColumns.includes(col));
    const remaining = baseColumns.filter((col) => !columnOrder.includes(col));
    return [...ordered, ...remaining];
  }, [baseColumns, columnOrder]);

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

  const getColumnWidth = useCallback(
    (col: string) => columnWidths[col] || DEFAULT_COL_WIDTH,
    [columnWidths]
  );

  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(col);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[col] || DEFAULT_COL_WIDTH;
  }, [columnWidths]);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, resizeStartWidth.current + delta));
      setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumn]);

  // Virtual row rendering
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const mobileVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="This table is empty."
      />
    );
  }

  if (filteredData.length === 0) {
    return (
      <EmptyState
        title="No matches"
        description="Try a different search term."
      />
    );
  }

  // Mobile card view
  if (isMobile) {
    const previewColumns = displayColumns.filter((c) => !primaryKeys.includes(c)).slice(0, 3);

    return (
      <div
        ref={mobileScrollRef}
        className="overflow-auto flex-1"
        style={{ height: 'calc(100vh - 280px)', minHeight: '200px' }}
      >
        <div
          style={{
            height: mobileVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowIndex = virtualRow.index;
            const row = filteredData[rowIndex];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={mobileVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="px-1 pb-2"
              >
                <MobileRowCard
                  row={row}
                  rowIndex={rowIndex}
                  columns={columns}
                  primaryKeys={primaryKeys}
                  previewColumns={previewColumns}
                  columnTypes={columnTypes}
                  columnSchema={columnSchema}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onCellUpdate={onCellUpdate}
                  onRowDelete={onRowDelete}
                  getRowPrimaryKeys={getRowPrimaryKeys}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const getSortIndicator = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') return '\u2191';
      if (sortDirection === 'desc') return '\u2193';
    }
    return '\u2195';
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

  // Column drag-to-reorder
  const handleDragStart = (e: React.DragEvent, column: string) => {
    dragColumnRef.current = column;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', column);
    // Make the drag ghost semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    dragColumnRef.current = null;
    setDragOverColumn(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragColumnRef.current && dragColumnRef.current !== column) {
      setDragOverColumn(column);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    const sourceColumn = dragColumnRef.current;
    if (!sourceColumn || sourceColumn === targetColumn) return;

    const currentOrder = columnOrder || [...displayColumns];
    const sourceIndex = currentOrder.indexOf(sourceColumn);
    const targetIndex = currentOrder.indexOf(targetColumn);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, sourceColumn);
    setColumnOrder(newOrder);
    setDragOverColumn(null);
    dragColumnRef.current = null;
  };

  // Context menu builders
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const headerContextMenu = (e: React.MouseEvent, column: string) => {
    const items: ContextMenuEntry[] = [];
    if (onSort) {
      items.push(
        { label: 'Sort ascending', onClick: () => { if (sortColumn !== column || sortDirection !== 'asc') onSort(column); } },
        { label: 'Sort descending', onClick: () => { if (sortColumn !== column) onSort(column); if (sortDirection === 'asc') onSort(column); } },
        { type: 'divider' },
      );
    }
    items.push(
      { label: frozenColumn === column ? 'Unfreeze column' : 'Freeze column', onClick: () => setFrozenColumn(frozenColumn === column ? null : column) },
      { label: 'Copy column name', onClick: () => copyToClipboard(column) },
    );
    if (visibleColumns && visibleColumns.length > 1) {
      items.push(
        { type: 'divider' },
        { label: 'Hide column', onClick: () => {
          // This requires the parent to handle visibility - we'll just signal intent
          // For now we can't remove from visibleColumns from inside DataTable
        }, disabled: true },
      );
    }
    showContextMenu(e, items);
  };

  const cellContextMenu = (e: React.MouseEvent, row: any, column: string, rowIndex: number) => {
    const cellValue = row[column];
    const valueStr = cellValue !== null && cellValue !== undefined ? String(cellValue) : 'NULL';
    const rowJson = JSON.stringify(row, null, 2);
    const insertCols = columns.map(c => `"${c}"`).join(', ');
    const insertVals = columns.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ');
    const insertSql = `INSERT INTO "${''}" (${insertCols}) VALUES (${insertVals});`;

    const items: ContextMenuEntry[] = [
      { label: 'Copy value', onClick: () => copyToClipboard(valueStr) },
      { label: 'Copy row as JSON', onClick: () => copyToClipboard(rowJson) },
      { label: 'Copy row as INSERT', onClick: () => copyToClipboard(insertSql) },
    ];

    if (canEdit && !primaryKeys.includes(column)) {
      items.push(
        { type: 'divider' },
        { label: 'Edit cell', onClick: () => {
          setEditingCell({ row: rowIndex, col: column });
          setExpandedRow(null);
        }},
      );
    }

    if (canDelete) {
      items.push(
        { type: 'divider' },
        { label: 'Delete row', onClick: () => onRowDelete?.(getRowPrimaryKeys(row)), danger: true },
      );
    }

    showContextMenu(e, items);
  };

  // Calculate frozen column offset
  const frozenColIndex = frozenColumn ? displayColumns.indexOf(frozenColumn) : -1;
  const frozenCols = frozenColIndex >= 0 ? displayColumns.slice(0, frozenColIndex + 1) : [];
  const frozenWidth = frozenCols.reduce((sum, col) => sum + getColumnWidth(col), 0);

  const totalTableWidth = displayColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);

  const renderCellContent = (row: any, column: string, rowIndex: number) => {
    if (canEdit && !primaryKeys.includes(column)) {
      return (
        <EditableCell
          value={row[column]}
          column={column}
          columnType={columnTypes[column]}
          isEditing={editingCell?.row === rowIndex && editingCell?.col === column}
          onStartEdit={() => {
            setEditingCell({ row: rowIndex, col: column });
            setExpandedRow(null);
          }}
          onSave={(col, newValue) => handleCellSave(row, col, newValue)}
          onCancel={() => setEditingCell(null)}
        />
      );
    }

    const formatter = findFormatter(column);
    if (formatter) {
      const formatted = applyFormatter(row[column], formatter.preset);
      return <FormattedCell formatted={formatted} rawValue={row[column]} />;
    }

    const cellValue = row[column];
    const displayStr = cellValue !== null && cellValue !== undefined
      ? (typeof cellValue === 'object' ? JSON.stringify(cellValue) : String(cellValue))
      : null;

    return (
      <div
        className="truncate"
        title={displayStr || 'NULL'}
      >
        {displayStr !== null
          ? displayStr
          : <span className="text-muted italic">NULL</span>}
      </div>
    );
  };

  const isFrozen = (col: string) => frozenCols.includes(col);

  const getColumnLeft = (col: string) => {
    let left = 0;
    for (const c of displayColumns) {
      if (c === col) break;
      left += getColumnWidth(c);
    }
    return left;
  };

  return (
    <div className="flex gap-0" style={{ height: 'calc(100vh - 320px)', minHeight: '250px' }}>
    <div className={`border border-border rounded-lg overflow-hidden flex flex-col ${selectedCell ? 'flex-1 min-w-0' : 'w-full'}`}>
      {!readOnlyMode && primaryKeys.length === 0 && columnSchema.length > 0 && (
        <div className="px-4 py-2 bg-warning/10 text-xs text-warning border-b border-border flex-shrink-0">
          Editing disabled -- no primary key detected
        </div>
      )}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative"
      >
        <div style={{ width: Math.max(totalTableWidth, 0), minWidth: '100%' }}>
          {/* Sticky header */}
          <div
            className="bg-bg-secondary sticky top-0 z-20 flex border-b border-border"
            style={{ height: HEADER_HEIGHT }}
          >
            {displayColumns.map((column) => {
              const frozen = isFrozen(column);
              const colLeft = frozen ? getColumnLeft(column) : undefined;
              return (
                <div
                  key={column}
                  aria-sort={getAriaSort(column)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, column)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, column)}
                  onDrop={(e) => handleDrop(e, column)}
                  className={`flex-shrink-0 px-4 flex items-center text-left text-xs font-medium text-secondary relative group select-none ${
                    onSort ? 'cursor-pointer hover:bg-bg-secondary/80' : ''
                  } ${sortColumn === column ? 'text-accent' : ''} ${
                    frozen ? 'sticky z-30 bg-bg-secondary border-r border-border' : ''
                  } ${dragOverColumn === column ? 'bg-accent/10 border-l-2 border-l-accent' : ''}`}
                  style={{
                    width: getColumnWidth(column),
                    left: colLeft,
                  }}
                  onClick={() => onSort?.(column)}
                  onContextMenu={(e) => headerContextMenu(e, column)}
                  title={column}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <div className="truncate">
                      <span className="block truncate">{column}</span>
                      {columnTypes[column] && (
                        <span className="block text-[10px] text-muted font-mono truncate">{columnTypes[column]}</span>
                      )}
                    </div>
                    {primaryKeys.includes(column) && (
                      <span className="text-accent text-[10px] font-medium bg-accent/10 px-1 rounded flex-shrink-0">PK</span>
                    )}
                    {onSort && (
                      <span className={`flex-shrink-0 text-[11px] ${sortColumn === column ? 'text-accent' : 'text-muted'}`}>
                        {getSortIndicator(column)}
                      </span>
                    )}
                  </div>
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-accent/40 active:bg-accent"
                    onMouseDown={(e) => handleResizeStart(e, column)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              );
            })}
          </div>

          {/* Virtualized rows */}
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowIndex = virtualRow.index;
              const row = filteredData[rowIndex];
              const isExpanded = expandedRow === rowIndex;

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className={`flex border-b border-border cursor-pointer hover:bg-bg-secondary/50 ${
                      rowIndex % 2 === 1 ? 'bg-bg-secondary/30' : 'bg-bg'
                    } ${isExpanded ? 'bg-bg-secondary/70' : ''}`}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => toggleRowExpand(rowIndex)}
                  >
                    {displayColumns.map((column) => {
                      const frozen = isFrozen(column);
                      const colLeft = frozen ? getColumnLeft(column) : undefined;
                      return (
                        <div
                          key={column}
                          className={`flex-shrink-0 px-4 flex items-center text-sm text-primary font-mono ${
                            frozen ? 'sticky z-10 bg-inherit border-r border-border' : ''
                          } ${selectedCell?.row === rowIndex && selectedCell?.col === column ? 'ring-2 ring-inset ring-accent/60 bg-accent/5' : ''}`}
                          style={{
                            width: getColumnWidth(column),
                            left: colLeft,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editingCell?.row === rowIndex && editingCell?.col === column) {
                              return;
                            }
                            setSelectedCell({ row: rowIndex, col: column, value: row[column] });
                          }}
                          onContextMenu={(e) => cellContextMenu(e, row, column, rowIndex)}
                        >
                          <div className="truncate w-full">
                            {renderCellContent(row, column, rowIndex)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded row detail */}
                  {isExpanded && (
                    <div className="border-b border-border">
                      <div className="bg-bg-secondary/40 p-4 space-y-1.5">
                        <div className="text-xs font-medium text-secondary mb-3 border-b border-border pb-2">
                          Row detail
                        </div>
                        {columns.map((column) => (
                          <div key={column} className="flex flex-col sm:flex-row sm:gap-4 gap-0.5 text-sm">
                            <span className="font-medium text-secondary sm:min-w-[150px] flex-shrink-0 text-xs sm:text-sm">
                              {column}
                            </span>
                            <span className="text-primary font-mono break-all whitespace-pre-wrap text-xs sm:text-sm">
                              {row[column] !== null && row[column] !== undefined
                                ? typeof row[column] === 'object'
                                  ? JSON.stringify(row[column], null, 2)
                                  : String(row[column])
                                : 'NULL'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </div>
    {selectedCell && (
      <div className="w-80 flex-shrink-0">
        <ValuePanel
          column={selectedCell.col}
          value={selectedCell.value}
          columnType={columnTypes[selectedCell.col]}
          onClose={() => setSelectedCell(null)}
          onSave={!!onCellUpdate ? (newValue) => {
            const row = filteredData[selectedCell.row];
            if (row) {
              handleCellSave(row, selectedCell.col, newValue);
              setSelectedCell({ ...selectedCell, value: newValue });
            }
          } : undefined}
        />
      </div>
    )}
    </div>
  );
};
