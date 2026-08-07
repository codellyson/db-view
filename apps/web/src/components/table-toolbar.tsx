import React from 'react';
import { MenuItem, MenuLabel, ToolbarButton, ToolbarDivider, ToolbarMenu } from './ui/toolbar';
import type { Filter } from '@/lib/filters';

export type TableView = 'data' | 'structure';

const Icon = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const PATH = {
  data: 'M3 5h18M3 12h18M3 19h18',
  structure: 'M4 6h16M4 6v12M20 6v12M4 18h16M10 6v12',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  sort: 'M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l-3 3m3-3l3 3',
  columns: 'M4 5h16v14H4zM10 5v14M16 5v14',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  chevronLeft: 'M15 19l-7-7 7-7',
  chevronRight: 'M9 5l7 7-7 7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z',
};

const PAGE_SIZES = [50, 100, 250, 500];

interface TableToolbarProps {
  view: TableView;
  onViewChange: (view: TableView) => void;

  columns: string[];
  visibleColumns: string[];
  onToggleColumn: (column: string) => void;
  onShowAllColumns: () => void;
  onHideAllColumns: () => void;

  filters: Filter[];
  onRemoveFilter: (column: string) => void;
  onClearFilters: () => void;

  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  onSort: (column: string) => void;
  onClearSort: () => void;

  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;

  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  countIsEstimate?: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;

  durationMs?: number | null;
  isBusy?: boolean;
  onRefresh: () => void;
  onRefreshSchema: () => void;

  canAddRecord?: boolean;
  onAddRecord: () => void;
  onImportCsv: () => void;
  onExport: () => void;
}

export function TableToolbar({
  view,
  onViewChange,
  columns,
  visibleColumns,
  onToggleColumn,
  onShowAllColumns,
  onHideAllColumns,
  filters,
  onRemoveFilter,
  onClearFilters,
  sortColumn,
  sortDirection,
  onSort,
  onClearSort,
  search,
  onSearchChange,
  searchInputRef,
  currentPage,
  itemsPerPage,
  totalItems,
  countIsEstimate,
  onPageChange,
  onItemsPerPageChange,
  durationMs,
  isBusy,
  onRefresh,
  onRefreshSchema,
  canAddRecord,
  onAddRecord,
  onImportCsv,
  onExport,
}: TableToolbarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const first = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const last = Math.min(currentPage * itemsPerPage, totalItems);
  const total = countIsEstimate ? `~${totalItems.toLocaleString()}` : totalItems.toLocaleString();
  const hiddenCount = columns.length - visibleColumns.length;

  return (
    <div className="flex items-center gap-1 h-11 shrink-0 border-b border-border pb-1.5 mb-1.5 overflow-x-auto">
      <ToolbarButton
        icon={<Icon d={PATH.data} />}
        active={view === 'data'}
        onClick={() => onViewChange('data')}
      >
        Data
      </ToolbarButton>
      <ToolbarButton
        icon={<Icon d={PATH.structure} />}
        active={view === 'structure'}
        onClick={() => onViewChange('structure')}
      >
        Structure
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarMenu
        label="Filters"
        icon={<Icon d={PATH.filter} />}
        badge={filters.length}
        disabled={view !== 'data'}
        width={280}
      >
        {() => (
          <>
            {filters.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted">
                No filters. Add one from a column header menu.
              </div>
            ) : (
              <>
                {filters.map((f) => (
                  <MenuItem key={f.column} onClick={() => onRemoveFilter(f.column)}>
                    <span className="flex-1 truncate">
                      <span className="text-primary">{f.column}</span>{' '}
                      <span className="text-muted">
                        {f.operator} {String(f.value ?? '')}
                      </span>
                    </span>
                    <span className="text-muted">✕</span>
                  </MenuItem>
                ))}
                <div className="-mx-1 px-1 border-t border-border mt-1 pt-1">
                  <MenuItem onClick={onClearFilters} danger>
                    Clear all filters
                  </MenuItem>
                </div>
              </>
            )}
          </>
        )}
      </ToolbarMenu>

      <ToolbarMenu
        label="Sort"
        icon={<Icon d={PATH.sort} />}
        active={!!sortColumn}
        disabled={view !== 'data' || columns.length === 0}
        width={240}
      >
        {() => (
          <>
            <MenuLabel>Sort by</MenuLabel>
            {columns.map((col) => (
              <MenuItem key={col} onClick={() => onSort(col)}>
                <span className="flex-1 truncate">{col}</span>
                {sortColumn === col && (
                  <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </MenuItem>
            ))}
            {sortColumn && (
              <div className="-mx-1 px-1 border-t border-border mt-1 pt-1">
                <MenuItem onClick={onClearSort}>Clear sort</MenuItem>
              </div>
            )}
          </>
        )}
      </ToolbarMenu>

      <ToolbarMenu
        label="Columns"
        icon={<Icon d={PATH.columns} />}
        badge={hiddenCount > 0 ? hiddenCount : undefined}
        disabled={view !== 'data' || columns.length === 0}
        width={240}
      >
        {() => (
          <>
            <div className="sticky top-0 z-10 flex gap-1 -mx-1 -mt-1 px-2 pt-1 pb-1 mb-1 border-b border-border bg-bg">
              <button
                type="button"
                onClick={onShowAllColumns}
                className="flex-1 px-2 py-1 text-xs rounded text-secondary hover:text-primary hover:bg-bg-secondary"
              >
                Show all
              </button>
              <button
                type="button"
                onClick={onHideAllColumns}
                className="flex-1 px-2 py-1 text-xs rounded text-secondary hover:text-primary hover:bg-bg-secondary"
              >
                Hide all
              </button>
            </div>
            {columns.map((col) => (
              <MenuItem key={col} onClick={() => onToggleColumn(col)}>
                <input
                  type="checkbox"
                  readOnly
                  checked={visibleColumns.includes(col)}
                  className="pointer-events-none accent-[rgb(var(--accent))]"
                />
                <span className="flex-1 truncate">{col}</span>
              </MenuItem>
            ))}
          </>
        )}
      </ToolbarMenu>

      <ToolbarButton
        icon={<Icon d={PATH.plus} />}
        variant="accent"
        disabled={!canAddRecord || view !== 'data'}
        onClick={onAddRecord}
        title="Add record (Alt+N)"
      >
        Add record
      </ToolbarButton>

      <div className="relative shrink-0 ml-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          <Icon d={PATH.search} className="h-3.5 w-3.5" />
        </span>
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search rows"
          disabled={view !== 'data'}
          aria-label="Search table rows"
          className="w-44 h-8 pl-8 pr-2 text-sm rounded-md border border-border bg-bg text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
        />
      </div>

      <div className="flex-1 min-w-2" />

      {view === 'data' && (
        <span className="w-14 text-right text-xs text-muted tabular-nums px-1 shrink-0">
          {durationMs == null
            ? ''
            : durationMs < 1000
              ? `${Math.round(durationMs)}ms`
              : `${(durationMs / 1000).toFixed(1)}s`}
        </span>
      )}

      {view === 'data' && (
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolbarButton
            icon={<Icon d={PATH.chevronLeft} />}
            aria-label="Previous page"
            title="Previous page"
            disabled={currentPage <= 1 || isBusy}
            onClick={() => onPageChange(currentPage - 1)}
          />
          <ToolbarMenu
            label={
              <span className="tabular-nums">
                {first}–{last} of {total}
              </span>
            }
            align="right"
            width={160}
          >
            {(close) => (
              <>
                <MenuLabel>Rows per page</MenuLabel>
                {PAGE_SIZES.map((size) => (
                  <MenuItem
                    key={size}
                    onClick={() => {
                      onItemsPerPageChange(size);
                      close();
                    }}
                  >
                    <span className="flex-1">{size}</span>
                    {size === itemsPerPage && <span className="text-accent">✓</span>}
                  </MenuItem>
                ))}
              </>
            )}
          </ToolbarMenu>
          <ToolbarButton
            icon={<Icon d={PATH.chevronRight} />}
            aria-label="Next page"
            title="Next page"
            disabled={currentPage >= totalPages || isBusy}
            onClick={() => onPageChange(currentPage + 1)}
          />
        </div>
      )}

      <ToolbarButton
        icon={<Icon d={PATH.refresh} className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />}
        aria-label="Refresh rows"
        title="Refresh rows (Alt+R)"
        onClick={onRefresh}
      />

      <ToolbarMenu icon={<Icon d={PATH.more} />} align="right" title="More actions" width={200}>
        {(close) => (
          <>
            <MenuItem
              onClick={() => {
                onRefreshSchema();
                close();
              }}
            >
              Refresh schema
            </MenuItem>
            <MenuItem
              onClick={() => {
                onImportCsv();
                close();
              }}
            >
              Import CSV
            </MenuItem>
            <MenuItem
              onClick={() => {
                onExport();
                close();
              }}
            >
              Export
            </MenuItem>
          </>
        )}
      </ToolbarMenu>
    </div>
  );
}
