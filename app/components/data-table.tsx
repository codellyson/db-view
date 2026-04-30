'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EmptyState } from './empty-state';
import { TableSkeleton } from './skeletons/table-skeleton';
import { EditableCell, type SaveIntent } from './editable-cell';
import { FormattedCell } from './formatted-cell';
import { SmartCellDisplay } from './smart-cell-display';
import { ColumnInfo } from '@/types';
import type { ColumnFormatter } from '@/lib/plugin-types';
import { applyFormatter } from '@/lib/formatter-presets';
import { ContextMenu, useContextMenu, type ContextMenuEntry } from './ui/context-menu';
import { MobileRowCard } from './mobile-row-card';
import { useIsMobile } from '../hooks/use-media-query';
import {
  usePendingChanges,
  rowKeyFromPks,
  type TablePending,
  type PendingInsert,
} from '../contexts/pending-changes-context';
import type { Filter } from '@/lib/filters';
import { ColumnFilterPopover } from './column-filter-popover';

const EMPTY_TABLE_PENDING: TablePending = { edits: {}, inserts: [], deletes: {} };

interface CellUpdateArgs {
  pks: Record<string, any>;
  column: string;
  original: any;
  next: any;
}

interface RowDeleteArgs {
  pks: Record<string, any>;
  snapshot: Record<string, any>;
}

export interface ForeignKeyTarget {
  schema: string;
  table: string;
  column: string;
}

export interface ForeignKeyClickArgs {
  sourceColumn: string;
  fk: ForeignKeyTarget;
  value: any;
}

export interface DataTableHandle {
  scrollToEmptyRow: () => void;
}

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
  // Schema + table identify the staging scope. When omitted (e.g. query
  // result panels), staging is disabled and the grid behaves read-only-ish.
  schema?: string;
  table?: string;
  onCellUpdate?: (args: CellUpdateArgs) => void;
  onRowDelete?: (args: RowDeleteArgs) => void;
  // When set, column widths and order are persisted to localStorage under
  // this key (e.g. `${databaseName}.${schema}.${table}`).
  layoutKey?: string;
  // Per-column FK targets so the grid can render clickable links and
  // header indicators on FK columns.
  foreignKeys?: Record<string, ForeignKeyTarget>;
  onForeignKeyClick?: (args: ForeignKeyClickArgs) => void;
  // Active per-column filters and the callback to mutate them. When omitted
  // the grid renders without a filter trigger in the header menu.
  filters?: Filter[];
  onAddFilter?: (filter: Filter) => void;
  onRemoveFilter?: (column: string) => void;
  /** When set, bulk Export action is enabled and forwards the selected rows. */
  onBulkExport?: (rows: any[]) => void;
  readOnlyMode?: boolean;
  // Columns that are part of an otherwise-editable result but cannot be
  // written back (e.g. computed expressions in a query result).
  readOnlyColumns?: string[];
  columnTypes?: Record<string, string>;
  activeFormatters?: ColumnFormatter[];
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const MIN_COL_WIDTH = 60;
const DEFAULT_COL_WIDTH = 140;
const MAX_COL_WIDTH = 600;

/**
 * Type-aware initial column width. Numeric / boolean / short-text columns
 * default to narrow; long-form types (timestamps, json) get more room. The
 * user can still resize and the override persists via layoutKey.
 */
function defaultWidthForType(columnType: string | undefined): number {
  if (!columnType) return DEFAULT_COL_WIDTH;
  const t = columnType.toLowerCase();
  if (t === 'boolean' || t === 'bool') return 70;
  if (t.includes('serial') || (t.includes('int') && !t.includes('interval'))) return 80;
  if (t === 'numeric' || t === 'decimal' || t === 'real' || t === 'float' || t.includes('double')) return 100;
  if (t === 'date') return 110;
  if (t === 'time' || t === 'time without time zone' || t === 'time with time zone') return 90;
  if (t === 'timestamp' || t === 'timestamptz' || t === 'timestamp without time zone' || t === 'timestamp with time zone' || t === 'datetime') return 200;
  if (t === 'uuid') return 110;
  if (t === 'json' || t === 'jsonb') return 220;
  if (t === 'text' || t.includes('varchar') || t.includes('char')) return 180;
  return DEFAULT_COL_WIDTH;
}

export const DataTable = forwardRef<DataTableHandle, DataTableProps>(function DataTable(
  {
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
    schema,
    table,
    layoutKey,
    onCellUpdate,
    onRowDelete,
    foreignKeys,
    onForeignKeyClick,
    filters,
    onAddFilter,
    onRemoveFilter,
    onBulkExport,
    readOnlyMode = false,
    readOnlyColumns,
    columnTypes = {},
    activeFormatters = [],
  },
  ref
) {
  const pending = usePendingChanges();
  const tablePending: TablePending =
    schema && table ? pending.getPending(schema, table) : EMPTY_TABLE_PENDING;
  const readOnlyColumnSet = useMemo(
    () => new Set(readOnlyColumns ?? []),
    [readOnlyColumns]
  );
  const isColumnEditable = useCallback(
    (col: string) => !readOnlyColumnSet.has(col),
    [readOnlyColumnSet]
  );
  const isMobile = useIsMobile();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string; value: any } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [frozenColumn, setFrozenColumn] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  // Tracks the table's available horizontal width so we can grow columns
  // to fill any slack between the sum of natural widths and the viewport.
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Hydrate / persist column layout to localStorage when layoutKey is set.
  // The layout snapshot is keyed per-table so different tables don't share
  // widths or ordering.
  const layoutHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!layoutKey || typeof window === 'undefined') return;
    if (layoutHydratedRef.current === layoutKey) return;
    layoutHydratedRef.current = layoutKey;
    try {
      const raw = localStorage.getItem(`dbview-layout-${layoutKey}`);
      if (!raw) {
        setColumnWidths({});
        setColumnOrder(null);
        setFrozenColumn(null);
        return;
      }
      const parsed = JSON.parse(raw);
      setColumnWidths(parsed.widths ?? {});
      setColumnOrder(Array.isArray(parsed.order) ? parsed.order : null);
      setFrozenColumn(parsed.frozen ?? null);
    } catch {
      // ignore
    }
  }, [layoutKey]);

  useEffect(() => {
    if (!layoutKey || typeof window === 'undefined') return;
    if (layoutHydratedRef.current !== layoutKey) return;
    try {
      const payload = JSON.stringify({
        widths: columnWidths,
        order: columnOrder,
        frozen: frozenColumn,
      });
      localStorage.setItem(`dbview-layout-${layoutKey}`, payload);
    } catch {
      // ignore
    }
  }, [layoutKey, columnWidths, columnOrder, frozenColumn]);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragColumnRef = useRef<string | null>(null);
  const [filterPopover, setFilterPopover] = useState<{ column: string; anchor: DOMRect } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const { menu: contextMenu, show: showContextMenu, close: closeContextMenu } = useContextMenu();

  // Track the data area's available width so auto-sized columns can grow to
  // fill the viewport instead of leaving a horizontal void on the right. We
  // use a callback ref + an element state value because the scroll container
  // is gated behind isLoading/empty-state branches — a `useEffect([])` would
  // run once with `ref.current === null` and never re-attach when the
  // container later mounts.
  const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);
  const setScrollContainer = useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollContainerEl(el);
  }, []);
  useEffect(() => {
    if (!scrollContainerEl) return;
    setContainerWidth(scrollContainerEl.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(scrollContainerEl);
    return () => ro.disconnect();
  }, [scrollContainerEl]);

  const canEdit = !readOnlyMode && primaryKeys.length > 0 && !!onCellUpdate;
  const canDelete = !readOnlyMode && primaryKeys.length > 0 && !!onRowDelete;
  // Inline insert flow runs only when a staging scope is provided. When the
  // grid is rendering query results without a single source table, inserts
  // are disabled.
  const canInsert = canEdit && !!schema && !!table;
  const stagedInserts = tablePending.inserts;

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

  // Width of the fixed left chrome (checkbox + row number columns) so the
  // scale calculation knows how much horizontal space is actually available
  // for data columns.
  const LEFT_CHROME_WIDTH = 28 + 40;

  const naturalWidthForCol = useCallback(
    (col: string) => defaultWidthForType(columnTypes[col]),
    [columnTypes]
  );

  // When the natural sum of auto-sized columns leaves slack vs. the
  // container, scale them up proportionally so the table fills the viewport.
  // User-resized columns (entries in `columnWidths`) are treated as fixed
  // and absorb no slack — they stay exactly where the user dragged them.
  const scaleFactor = useMemo(() => {
    if (containerWidth <= 0 || displayColumns.length === 0) return 1;
    let explicitTotal = 0;
    let autoTotal = 0;
    for (const col of displayColumns) {
      if (columnWidths[col]) explicitTotal += columnWidths[col];
      else autoTotal += naturalWidthForCol(col);
    }
    if (autoTotal <= 0) return 1;
    const available = containerWidth - LEFT_CHROME_WIDTH - explicitTotal;
    if (available <= autoTotal) return 1;
    return available / autoTotal;
  }, [containerWidth, displayColumns, columnWidths, naturalWidthForCol]);

  const getColumnWidth = useCallback(
    (col: string) => {
      if (columnWidths[col]) return columnWidths[col];
      return Math.round(naturalWidthForCol(col) * scaleFactor);
    },
    [columnWidths, naturalWidthForCol, scaleFactor]
  );

  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(col);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[col] || defaultWidthForType(columnTypes[col]);
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

  // Insert rows render after DB rows; an always-present empty row sits at
  // the very bottom when inserts are allowed.
  const insertRowCount = stagedInserts.length + (canInsert ? 1 : 0);
  const totalRowCount = filteredData.length + insertRowCount;
  const emptyRowVirtualIndex = filteredData.length + stagedInserts.length;

  // Compute and apply the next editing cell after a save with a directional
  // intent. Returns true when navigation actually moved.
  const moveEditingCell = useCallback(
    (currentRow: number, currentCol: string, intent: SaveIntent): boolean => {
      if (!intent) return false;
      const colIdx = displayColumns.indexOf(currentCol);
      if (colIdx === -1) return false;
      let nextRow = currentRow;
      let nextCol = currentCol;
      if (intent === 'right') {
        if (colIdx < displayColumns.length - 1) nextCol = displayColumns[colIdx + 1];
        else if (currentRow < totalRowCount - 1) {
          nextRow = currentRow + 1;
          nextCol = displayColumns[0];
        } else return false;
      } else if (intent === 'left') {
        if (colIdx > 0) nextCol = displayColumns[colIdx - 1];
        else if (currentRow > 0) {
          nextRow = currentRow - 1;
          nextCol = displayColumns[displayColumns.length - 1];
        } else return false;
      } else if (intent === 'down') {
        if (currentRow < totalRowCount - 1) nextRow = currentRow + 1;
        else return false;
      }
      setEditingCell({ row: nextRow, col: nextCol });
      return true;
    },
    [displayColumns, totalRowCount]
  );

  // Virtual row rendering — use measureElement for dynamic row heights
  // so expanded row details push subsequent rows down instead of overlapping.
  const rowVirtualizer = useVirtualizer({
    count: totalRowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const mobileVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToEmptyRow: () => {
        if (!canInsert) return;
        rowVirtualizer.scrollToIndex(emptyRowVirtualIndex, { align: 'end' });
      },
    }),
    [canInsert, emptyRowVirtualIndex, rowVirtualizer]
  );

  if (isLoading) {
    return <TableSkeleton />;
  }

  // Show empty state only when there's truly nothing to show — no DB rows,
  // no staged inserts, and no inline empty row.
  if (data.length === 0 && stagedInserts.length === 0 && !canInsert) {
    const hasFilters = (filters?.length ?? 0) > 0;
    return (
      <EmptyState
        title={hasFilters ? 'No rows match the filter' : 'This table has no rows yet'}
        description={
          hasFilters
            ? 'Try removing one or more filters above the grid.'
            : 'Add a row to get started.'
        }
        action={
          hasFilters && onRemoveFilter ? (
            <button
              onClick={() => filters?.forEach((f) => onRemoveFilter(f.column))}
              className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent-hover transition-colors"
            >
              Clear filters
            </button>
          ) : undefined
        }
      />
    );
  }

  if (data.length > 0 && filteredData.length === 0 && stagedInserts.length === 0 && !canInsert) {
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
                  isColumnEditable={isColumnEditable}
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

  const handleCellSave = (
    row: any,
    column: string,
    newValue: any,
    intent: SaveIntent,
    rowIndex: number
  ) => {
    const oldValue = row[column];
    const normalizedOld = oldValue === null || oldValue === undefined ? null : String(oldValue);
    const normalizedNew = newValue === null ? null : String(newValue);

    if (normalizedOld !== normalizedNew) {
      onCellUpdate?.({
        pks: getRowPrimaryKeys(row),
        column,
        original: oldValue,
        next: newValue,
      });
    }
    if (!moveEditingCell(rowIndex, column, intent)) {
      setEditingCell(null);
    }
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
    if (onAddFilter) {
      const headerEl = (e.currentTarget as HTMLElement)?.getBoundingClientRect();
      items.push({
        label: filters?.some((f) => f.column === column) ? 'Edit filter…' : 'Filter…',
        onClick: () => setFilterPopover({ column, anchor: headerEl ?? new DOMRect(100, 100, 200, 24) }),
      });
      if (filters?.some((f) => f.column === column) && onRemoveFilter) {
        items.push({
          label: 'Clear filter',
          onClick: () => onRemoveFilter(column),
        });
      }
      items.push({ type: 'divider' });
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

    const rowPks = getRowPrimaryKeys(row);
    const rowKey = primaryKeys.length > 0 ? rowKeyFromPks(rowPks) : null;
    const stagedEdit = rowKey ? tablePending.edits[rowKey] : undefined;
    const stagedDelete = rowKey ? tablePending.deletes[rowKey] : undefined;
    const isCellStaged = !!stagedEdit?.changes[column];

    const items: ContextMenuEntry[] = [
      { label: 'Copy value', onClick: () => copyToClipboard(valueStr) },
      { label: 'Copy row as JSON', onClick: () => copyToClipboard(rowJson) },
      { label: 'Copy row as INSERT', onClick: () => copyToClipboard(insertSql) },
    ];

    if (canEdit && !primaryKeys.includes(column) && isColumnEditable(column) && !stagedDelete) {
      items.push(
        { type: 'divider' },
        { label: 'Edit cell', onClick: () => {
          setEditingCell({ row: rowIndex, col: column });
          setExpandedRow(null);
        }},
        {
          label: 'Set NULL',
          onClick: () =>
            onCellUpdate?.({
              pks: rowPks,
              column,
              original: row[column],
              next: null,
            }),
        },
      );
      if (isCellStaged && schema && table && rowKey) {
        items.push({
          label: 'Revert change',
          onClick: () => pending.unstageEdit({ schema, table, rowKey, column }),
        });
      }
    }

    if (stagedDelete && schema && table && rowKey) {
      items.push(
        { type: 'divider' },
        {
          label: 'Unstage delete',
          onClick: () => pending.unstageDelete({ schema, table, rowKey }),
        },
      );
    } else if (canDelete) {
      items.push(
        { type: 'divider' },
        {
          label: 'Delete row',
          onClick: () => onRowDelete?.({ pks: rowPks, snapshot: row }),
          danger: true,
        },
      );
    }

    showContextMenu(e, items);
  };

  const insertRowContextMenu = (e: React.MouseEvent, ins: PendingInsert) => {
    e.preventDefault();
    if (!schema || !table) return;
    showContextMenu(e, [
      {
        label: 'Discard new row',
        onClick: () => pending.unstageInsert({ schema, table, tempId: ins.tempId }),
        danger: true,
      },
    ]);
  };

  // Frozen-column offsets — the set of columns at-or-before the current
  // frozen anchor. `getColumnLeft` reads this when computing each frozen
  // cell's `left` style so they stick correctly while horizontally scrolling.
  const frozenColIndex = frozenColumn ? displayColumns.indexOf(frozenColumn) : -1;
  const frozenCols = frozenColIndex >= 0 ? displayColumns.slice(0, frozenColIndex + 1) : [];

  const totalTableWidth = displayColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);

  const renderCellContent = (row: any, column: string, rowIndex: number) => {
    const rowPks = primaryKeys.length > 0 ? getRowPrimaryKeys(row) : null;
    const rowKey = rowPks ? rowKeyFromPks(rowPks) : null;
    const stagedEdit = rowKey ? tablePending.edits[rowKey] : undefined;
    const stagedCell = stagedEdit?.changes[column];
    const isStagedDelete = rowKey ? !!tablePending.deletes[rowKey] : false;

    // When a cell has a pending edit, show the staged `next` value so the
    // user sees what they're about to commit. Original is preserved in the
    // store for undo / SQL preview.
    const displayValue = stagedCell ? stagedCell.next : row[column];

    if (canEdit && !primaryKeys.includes(column) && isColumnEditable(column) && !isStagedDelete) {
      return (
        <EditableCell
          value={displayValue}
          column={column}
          columnType={columnTypes[column]}
          isEditing={editingCell?.row === rowIndex && editingCell?.col === column}
          onStartEdit={() => {
            setEditingCell({ row: rowIndex, col: column });
            setExpandedRow(null);
          }}
          onSave={(col, newValue, intent) => handleCellSave(row, col, newValue, intent ?? null, rowIndex)}
          onCancel={() => setEditingCell(null)}
        />
      );
    }

    const formatter = findFormatter(column);
    if (formatter) {
      const formatted = applyFormatter(displayValue, formatter.preset);
      return <FormattedCell formatted={formatted} rawValue={displayValue} />;
    }

    return (
      <div className="truncate">
        <SmartCellDisplay
          value={displayValue}
          column={column}
          columnType={columnTypes[column]}
        />
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
    <div className="border border-border rounded-lg overflow-hidden flex flex-col w-full">
      {!readOnlyMode && primaryKeys.length === 0 && columnSchema.length > 0 && (
        <div className="px-4 py-2 bg-warning/10 text-xs text-warning border-b border-border flex-shrink-0">
          Editing disabled -- no primary key detected
        </div>
      )}
      {selectedRowKeys.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-xs border-b border-border flex-shrink-0">
          <span className="text-primary font-medium">
            {selectedRowKeys.size} {selectedRowKeys.size === 1 ? 'row' : 'rows'} selected
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {onBulkExport && (
              <button
                onClick={() => {
                  const rows = filteredData.filter((r) =>
                    selectedRowKeys.has(rowKeyFromPks(getRowPrimaryKeys(r)))
                  );
                  onBulkExport(rows);
                }}
                className="px-2 py-0.5 text-xs font-medium text-secondary hover:text-primary hover:bg-bg-secondary rounded transition-colors"
              >
                Export
              </button>
            )}
            {canInsert && schema && table && (
              <button
                onClick={() => {
                  const rows = filteredData.filter((r) =>
                    selectedRowKeys.has(rowKeyFromPks(getRowPrimaryKeys(r)))
                  );
                  for (const r of rows) {
                    const values: Record<string, any> = {};
                    for (const col of columns) {
                      // Drop PK columns so the DB can regenerate them.
                      if (primaryKeys.includes(col)) continue;
                      values[col] = r[col];
                    }
                    pending.stageInsert({ schema, table, values });
                  }
                  setSelectedRowKeys(new Set());
                }}
                className="px-2 py-0.5 text-xs font-medium text-secondary hover:text-primary hover:bg-bg-secondary rounded transition-colors"
              >
                Duplicate
              </button>
            )}
            {canDelete && schema && table && (
              <button
                onClick={() => {
                  const rows = filteredData.filter((r) =>
                    selectedRowKeys.has(rowKeyFromPks(getRowPrimaryKeys(r)))
                  );
                  for (const r of rows) {
                    pending.stageDelete({
                      schema,
                      table,
                      pks: getRowPrimaryKeys(r),
                      snapshot: r,
                    });
                  }
                  setSelectedRowKeys(new Set());
                }}
                className="px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10 rounded transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => setSelectedRowKeys(new Set())}
              className="px-2 py-0.5 text-xs text-muted hover:text-primary transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      <div
        ref={setScrollContainer}
        className="flex-1 overflow-auto relative"
      >
        <div style={{ width: Math.max(totalTableWidth, 0), minWidth: '100%' }}>
          {/* Sticky header */}
          <div
            className="bg-bg-secondary sticky top-0 z-20 flex border-b border-border"
            style={{ height: HEADER_HEIGHT }}
          >
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 28 }}>
              {primaryKeys.length > 0 && (
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  aria-label="Select all visible rows"
                  ref={(el) => {
                    if (!el) return;
                    const visibleKeys = filteredData
                      .map((r) => rowKeyFromPks(getRowPrimaryKeys(r)));
                    const total = visibleKeys.length;
                    const sel = visibleKeys.filter((k) => selectedRowKeys.has(k)).length;
                    el.indeterminate = sel > 0 && sel < total;
                  }}
                  checked={
                    filteredData.length > 0 &&
                    filteredData.every((r) => selectedRowKeys.has(rowKeyFromPks(getRowPrimaryKeys(r))))
                  }
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedRowKeys((prev) => {
                      const next = new Set(prev);
                      for (const r of filteredData) {
                        const k = rowKeyFromPks(getRowPrimaryKeys(r));
                        if (checked) next.add(k);
                        else next.delete(k);
                      }
                      return next;
                    });
                  }}
                />
              )}
            </div>
            <div className="flex-shrink-0" style={{ width: 40 }} />
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
                  className={`flex-shrink-0 px-3 flex items-center text-left text-xs font-medium text-secondary relative group select-none ${
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
                    {foreignKeys?.[column] && (
                      <span
                        className="text-[10px] font-medium text-blue-400 flex-shrink-0"
                        title={`FK → ${foreignKeys[column].schema}.${foreignKeys[column].table}.${foreignKeys[column].column}`}
                      >
                        →
                      </span>
                    )}
                    {filters?.some((f) => f.column === column) && (
                      <span
                        className="text-[10px] font-medium text-warning flex-shrink-0"
                        title="Filter active"
                      >
                        ⚲
                      </span>
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
              const idx = virtualRow.index;

              // Pending insert row (green tint, all columns editable).
              if (idx >= filteredData.length && idx < filteredData.length + stagedInserts.length) {
                const ins = stagedInserts[idx - filteredData.length];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className="flex border-b border-border bg-success/15 hover:bg-success/20"
                      style={{ height: ROW_HEIGHT }}
                      onContextMenu={(e) => insertRowContextMenu(e, ins)}
                    >
                      <div className="flex-shrink-0" style={{ width: 28 }} />
                      <div
                        className="flex-shrink-0 flex items-center justify-center text-success font-bold"
                        style={{ width: 40 }}
                        aria-label="New row"
                        title="New row"
                      >
                        +
                      </div>
                      {displayColumns.map((column) => {
                        const frozen = isFrozen(column);
                        const colLeft = frozen ? getColumnLeft(column) : undefined;
                        const cellEditing = editingCell?.row === idx && editingCell?.col === column;
                        const cellValue = ins.values[column];
                        return (
                          <div
                            key={column}
                            className={`flex-shrink-0 px-3 flex items-center text-sm text-primary font-mono ${
                              frozen ? 'sticky z-10 bg-inherit border-r border-border' : ''
                            } ${
                              selectedCell?.row === idx && selectedCell?.col === column
                                ? 'ring-2 ring-inset ring-accent/60'
                                : ''
                            }`}
                            style={{ width: getColumnWidth(column), left: colLeft }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cellEditing) return;
                              setSelectedCell({ row: idx, col: column, value: cellValue });
                            }}
                            onContextMenu={(e) => {
                              e.stopPropagation();
                              insertRowContextMenu(e, ins);
                            }}
                          >
                            <div className="truncate w-full">
                              <EditableCell
                                value={cellValue}
                                column={column}
                                columnType={columnTypes[column]}
                                isEditing={cellEditing}
                                onStartEdit={() => setEditingCell({ row: idx, col: column })}
                                onSave={(col, newValue, intent) => {
                                  if (!schema || !table) return;
                                  pending.updateInsert({
                                    schema,
                                    table,
                                    tempId: ins.tempId,
                                    column: col,
                                    value: newValue,
                                  });
                                  if (!moveEditingCell(idx, col, intent ?? null)) {
                                    setEditingCell(null);
                                  }
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Always-empty placeholder row at the bottom — typing into a
              // cell stages a new pending insert with that one cell value.
              if (canInsert && idx === emptyRowVirtualIndex) {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className="flex border-b border-border bg-success/5 hover:bg-success/10"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="flex-shrink-0" style={{ width: 28 }} />
                      <div
                        className="flex-shrink-0 flex items-center justify-center text-success/60"
                        style={{ width: 40 }}
                        aria-label="Add new row"
                        title="Add new row"
                      >
                        +
                      </div>
                      {displayColumns.map((column) => {
                        const frozen = isFrozen(column);
                        const colLeft = frozen ? getColumnLeft(column) : undefined;
                        const cellEditing = editingCell?.row === idx && editingCell?.col === column;
                        return (
                          <div
                            key={column}
                            className={`flex-shrink-0 px-3 flex items-center text-sm text-muted font-mono ${
                              frozen ? 'sticky z-10 bg-inherit border-r border-border' : ''
                            }`}
                            style={{ width: getColumnWidth(column), left: colLeft }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cellEditing) return;
                              setSelectedCell({ row: idx, col: column, value: undefined });
                            }}
                          >
                            <div className="truncate w-full">
                              <EditableCell
                                value={undefined}
                                column={column}
                                columnType={columnTypes[column]}
                                isEditing={cellEditing}
                                onStartEdit={() => setEditingCell({ row: idx, col: column })}
                                onSave={(col, newValue, intent) => {
                                  if (!schema || !table) return;
                                  pending.stageInsert({
                                    schema,
                                    table,
                                    values: { [col]: newValue },
                                  });
                                  if (!moveEditingCell(idx, col, intent ?? null)) {
                                    setEditingCell(null);
                                  }
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // DB row.
              const rowIndex = idx;
              const row = filteredData[rowIndex];
              const isExpanded = expandedRow === rowIndex;
              const rowPks = primaryKeys.length > 0 ? getRowPrimaryKeys(row) : null;
              const rowKey = rowPks ? rowKeyFromPks(rowPks) : null;
              const isStagedDelete = rowKey ? !!tablePending.deletes[rowKey] : false;
              const stagedEdit = rowKey ? tablePending.edits[rowKey] : undefined;

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
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
                      isStagedDelete
                        ? 'bg-danger/25 line-through text-secondary border-l-4 border-l-danger'
                        : rowIndex % 2 === 1
                          ? 'bg-bg-secondary/30'
                          : 'bg-bg'
                    } ${isExpanded ? 'bg-bg-secondary/70' : ''}`}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => toggleRowExpand(rowIndex)}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{ width: 28 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {rowKey && (
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          aria-label={`Select row ${rowIndex + 1}`}
                          checked={selectedRowKeys.has(rowKey)}
                          onClick={(e) => {
                            const me = e as React.MouseEvent;
                            if (me.shiftKey && lastClickedIndexRef.current != null) {
                              e.preventDefault();
                              const from = Math.min(lastClickedIndexRef.current, rowIndex);
                              const to = Math.max(lastClickedIndexRef.current, rowIndex);
                              setSelectedRowKeys((prev) => {
                                const next = new Set(prev);
                                for (let i = from; i <= to; i++) {
                                  const r = filteredData[i];
                                  if (!r) continue;
                                  next.add(rowKeyFromPks(getRowPrimaryKeys(r)));
                                }
                                return next;
                              });
                            }
                          }}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            lastClickedIndexRef.current = rowIndex;
                            setSelectedRowKeys((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(rowKey);
                              else next.delete(rowKey);
                              return next;
                            });
                          }}
                        />
                      )}
                    </div>
                    <div
                      className="flex-shrink-0 flex items-center justify-center text-[10px] font-mono text-muted hover:text-primary transition-colors group/rownum"
                      style={{ width: 40 }}
                      aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                      title={`Row ${rowIndex + 1}`}
                    >
                      <span className={`group-hover/rownum:hidden ${isExpanded ? 'hidden' : ''}`}>{rowIndex + 1}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3.5 w-3.5 transition-transform duration-150 hidden group-hover/rownum:block ${isExpanded ? 'rotate-90 !block' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {displayColumns.map((column) => {
                      const frozen = isFrozen(column);
                      const colLeft = frozen ? getColumnLeft(column) : undefined;
                      const isStagedCell = !!stagedEdit?.changes[column];
                      const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === column;
                      return (
                        <div
                          key={column}
                          className={`flex-shrink-0 px-3 flex items-center text-sm text-primary font-mono relative ${
                            frozen ? 'sticky z-10 bg-inherit border-r border-border' : ''
                          } ${
                            isStagedCell && !isStagedDelete
                              ? 'bg-warning/30 border-l-2 border-l-warning'
                              : isSelected ? 'ring-2 ring-inset ring-accent/60 bg-accent/5' : ''
                          }`}
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
                          <div className="truncate flex-1 min-w-0">
                            {renderCellContent(row, column, rowIndex)}
                          </div>
                          {foreignKeys?.[column] && row[column] !== null && row[column] !== undefined && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!onForeignKeyClick) return;
                                onForeignKeyClick({
                                  sourceColumn: column,
                                  fk: foreignKeys[column],
                                  value: row[column],
                                });
                              }}
                              className="flex-shrink-0 ml-1 p-0.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                              title={`Open ${foreignKeys[column].schema}.${foreignKeys[column].table} where ${foreignKeys[column].column} = ${String(row[column])}`}
                              aria-label="Follow foreign key"
                            >
                              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v3.69a.75.75 0 0 0 1.5 0v-5.5a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0 0 1.5h3.69L5.22 13.72a.75.75 0 0 0 0 1.06Z"/>
                              </svg>
                            </button>
                          )}
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
      {filterPopover && onAddFilter && (
        <ColumnFilterPopover
          column={filterPopover.column}
          columnType={columnTypes[filterPopover.column]}
          initial={filters?.find((f) => f.column === filterPopover.column)}
          anchorRect={filterPopover.anchor}
          onApply={(filter) => {
            onAddFilter(filter);
            setFilterPopover(null);
          }}
          onClear={() => onRemoveFilter?.(filterPopover.column)}
          onClose={() => setFilterPopover(null)}
        />
      )}
    </div>
    </div>
  );
});
