"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MainContent } from "./main-content";
import { DataTable, type DataTableHandle } from "./data-table";
import { TableSchema } from "./table-schema";
import { Pagination } from "./pagination";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { ResizableSplitter } from "./resizable-splitter";
import { MobileMenu } from "./mobile-menu";
import { TableList } from "./table-list";
import { ColumnVisibility } from "./column-visibility";
import { ExportModal } from "./export-modal";
import { Breadcrumb } from "./breadcrumb";
import { RelationshipDisplay } from "./relationship-display";
import { PendingChangesBar } from "./pending-changes-bar";
import { ReviewSqlModal } from "./review-sql-modal";
import { TablePicker } from "./table-picker";
import { CommandPalette, type CommandAction } from "./command-palette";
import { FKSidePanel, type FKQuery } from "./fk-side-panel";
import { FilterChips } from "./filter-chips";
import type { ForeignKeyTarget } from "./data-table";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { TableStats } from "./table-stats";
import { CSVImportDialog } from "./csv-import-dialog";
import { TableCreationWizard } from "./table-creation-wizard";
import { BatchExportModal } from "./batch-export-modal";
import { TabBar } from "./tab-bar";
import { QueryEditor } from "./query-editor";
import { Button } from "./ui/button";
import { useConnection } from "../contexts/connection-context";
import { useToast } from "../contexts/toast-context";
import { useDashboard } from "../contexts/dashboard-context";
import { usePendingChanges } from "../contexts/pending-changes-context";
import { useTheme } from "../contexts/theme-context";
import { useKeyboardShortcuts, type Shortcut } from "../hooks/use-keyboard-shortcuts";
import { useTableListPrefs } from "../hooks/use-table-list-prefs";
import { useUrlState } from "../hooks/use-url-state";
import { usePlugins } from "../hooks/use-plugins";

export function Dashboard() {
  const { isConnected, databaseName, databaseType } = useConnection();
  const { addToast } = useToast();
  const {
    tables,
    schemas,
    selectedSchema,
    selectedTable,
    tableData,
    columns,
    schema,
    views,
    materializedViews,
    dbFunctions,
    relationships,
    indexes,
    isLoadingTables,
    isLoading,
    isLoadingSchema,
    currentPage,
    totalItems,
    countIsEstimate,
    sortColumn,
    sortDirection,
    visibleColumns,
    tableSearch,
    tableFilters,
    addTableFilter,
    removeTableFilter,
    clearTableFilters,
    error,
    itemsPerPage,
    setSelectedTable,
    setCurrentPage,
    setVisibleColumns,
    setTableSearch,
    loadTables,
    loadTableData,
    handleSchemaChange,
    handleTableSelect,
    handleSort,
    readOnlyMode,
    primaryKeys,
    refreshTableData,
    tableStats,
    isLoadingStats,
    setItemsPerPage,
    openTabs,
    activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    closeAllTabs,
    closeOtherTabs,
    reorderTabs,
    toggleTabPin,
    isQueryTab,
    queryTabResults,
    openEditorTab,
    isEditorTab,
    schemaMap,
    tableRowCounts,
    savedQueries,
    deleteSavedQuery,
  } = useDashboard();

  const pending = usePendingChanges();
  const { toggleMode } = useTheme();
  const tableListPrefs = useTableListPrefs(databaseName);
  useUrlState();
  const { allFormatters } = usePlugins();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const dataTableRef = useRef<DataTableHandle>(null);

  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    for (const col of schema) {
      types[col.name] = col.type;
    }
    return types;
  }, [schema]);

  // Per-column FK target lookup for the active table. Used by DataTable to
  // render header indicators and cell-level navigation chevrons.
  const foreignKeys = useMemo(() => {
    const map: Record<string, ForeignKeyTarget> = {};
    for (const r of relationships) {
      if (r.source_column && r.target_table) {
        map[r.source_column] = {
          schema: r.target_schema || selectedSchema,
          table: r.target_table,
          column: r.target_column,
        };
      }
    }
    return map;
  }, [relationships, selectedSchema]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'schema' | 'stats' | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [fkQuery, setFkQuery] = useState<FKQuery | null>(null);
  const [editorEditableTarget, setEditorEditableTarget] = useState<{ schema: string; table: string } | null>(null);

  const reviewTarget: { schema: string; table: string } | null = selectedTable
    ? { schema: selectedSchema, table: selectedTable }
    : editorEditableTarget;
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [bulkExportRows, setBulkExportRows] = useState<any[] | null>(null);

  const onTableSelect = (table: string) => {
    tableListPrefs.recordOpen(table);
    handleTableSelect(table);
    setIsMobileMenuOpen(false);
  };


  const shortcuts: Shortcut[] = useMemo(() => [
    {
      key: 'k', alt: true, description: 'Focus table search',
      category: 'Navigation',
      action: () => searchInputRef.current?.focus(),
    },
    {
      key: 'j', alt: true, description: 'Toggle sidebar',
      category: 'Navigation',
      action: () => setIsMobileMenuOpen((prev) => !prev),
    },
    {
      key: '/', meta: true, description: 'Show keyboard shortcuts',
      category: 'General',
      action: () => setIsShortcutsHelpOpen((prev) => !prev),
    },
    {
      key: 'q', alt: true, description: 'New SQL editor tab',
      category: 'Navigation',
      action: () => openEditorTab(),
    },
    {
      key: 'n', alt: true, description: 'Add new row',
      category: 'Editing',
      action: () => {
        if (!readOnlyMode && primaryKeys.length > 0 && selectedTable) {
          dataTableRef.current?.scrollToEmptyRow();
        }
      },
    },
    {
      key: 'r', alt: true, description: 'Refresh table data',
      category: 'Navigation',
      action: () => {
        if (selectedTable) refreshTableData();
      },
    },
    {
      key: '1', alt: true, description: 'Focus sidebar',
      category: 'Navigation',
      action: () => {
        const firstInput = sidebarRef.current?.querySelector<HTMLElement>('input, button');
        firstInput?.focus();
      },
    },
    {
      key: '2', alt: true, description: 'Focus main content',
      category: 'Navigation',
      action: () => {
        const firstFocusable = mainContentRef.current?.querySelector<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      },
    },
    {
      key: 'Escape', description: 'Close modal / cancel',
      category: 'General',
      action: () => {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        else if (isTablePickerOpen) setIsTablePickerOpen(false);
        else if (fkQuery) setFkQuery(null);
        else if (isReviewOpen) setIsReviewOpen(false);
        else if (isShortcutsHelpOpen) setIsShortcutsHelpOpen(false);
      },
    },
    {
      key: 's', meta: true, description: 'Save pending changes (Review SQL)',
      category: 'Editing',
      action: () => {
        if (reviewTarget && pending.getCount(reviewTarget.schema, reviewTarget.table) > 0) {
          setIsReviewOpen(true);
        }
      },
    },
    {
      key: 'z', meta: true, description: 'Undo last staged edit',
      category: 'Editing',
      action: () => pending.undo(),
    },
    {
      key: 'z', meta: true, shift: true, description: 'Redo staged edit',
      category: 'Editing',
      action: () => pending.redo(),
    },
    {
      key: 't', meta: true, description: 'New SQL editor',
      category: 'Navigation',
      action: () => openEditorTab(),
    },
    {
      key: 'w', meta: true, description: 'Close active tab',
      category: 'Navigation',
      action: () => {
        if (activeTabId) closeTab(activeTabId);
      },
    },
    {
      key: 'f', meta: true, description: 'Find in result set',
      category: 'Navigation',
      action: () => {
        // Editor/query tabs register their own Cmd+F; only handle the
        // table-view case here.
        if (isEditorTab || isQueryTab) return;
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
    },
    {
      key: 'p', meta: true, description: 'Jump to table',
      category: 'Navigation',
      action: () => setIsTablePickerOpen((prev) => !prev),
    },
    {
      key: 'k', meta: true, description: 'Command palette',
      category: 'General',
      action: () => setIsCommandPaletteOpen((prev) => !prev),
    },
    {
      // Bare `?` (Shift + /) — companion to Cmd+/, matches the doc.
      key: '?', shift: true, description: 'Show keyboard shortcuts',
      category: 'General',
      action: () => setIsShortcutsHelpOpen((prev) => !prev),
    },
  ], [readOnlyMode, primaryKeys, selectedTable, selectedSchema, isShortcutsHelpOpen, isReviewOpen, openEditorTab, pending, activeTabId, closeTab, isEditorTab, isQueryTab, isTablePickerOpen, isCommandPaletteOpen, fkQuery, refreshTableData]);

  useKeyboardShortcuts(shortcuts);

  const pendingCountForActiveTable = reviewTarget
    ? pending.getCount(reviewTarget.schema, reviewTarget.table)
    : 0;

  const paletteActions: CommandAction[] = useMemo(() => [
    {
      id: 'new-editor',
      label: 'New SQL editor',
      category: 'Editor',
      shortcut: '⌘T',
      run: () => openEditorTab(),
    },
    {
      id: 'jump-to-table',
      label: 'Jump to table…',
      category: 'Navigate',
      shortcut: '⌘P',
      run: () => setIsTablePickerOpen(true),
    },
    {
      id: 'save-pending',
      label: 'Save pending changes',
      category: 'Edit',
      shortcut: '⌘S',
      enabled: pendingCountForActiveTable > 0,
      run: () => setIsReviewOpen(true),
    },
    {
      id: 'discard-pending',
      label: 'Discard pending changes',
      category: 'Edit',
      enabled: pendingCountForActiveTable > 0,
      run: () => {
        if (reviewTarget) pending.discardTable({ schema: reviewTarget.schema, table: reviewTarget.table });
      },
    },
    {
      id: 'refresh-table',
      label: 'Refresh table data',
      category: 'Edit',
      enabled: !!selectedTable,
      run: () => refreshTableData(),
    },
    {
      id: 'close-tab',
      label: 'Close active tab',
      category: 'Navigate',
      shortcut: '⌘W',
      enabled: !!activeTabId,
      run: () => {
        if (activeTabId) closeTab(activeTabId);
      },
    },
    {
      id: 'toggle-theme',
      label: 'Toggle theme (light/dark)',
      category: 'View',
      run: () => toggleMode(),
    },
    {
      id: 'show-shortcuts',
      label: 'Show keyboard shortcuts',
      category: 'Help',
      shortcut: '?',
      run: () => setIsShortcutsHelpOpen(true),
    },
  ], [
    pendingCountForActiveTable,
    selectedTable,
    selectedSchema,
    pending,
    activeTabId,
    closeTab,
    openEditorTab,
    refreshTableData,
    toggleMode,
  ]);

  const handleCellUpdate = ({
    pks,
    column,
    original,
    next,
  }: {
    pks: Record<string, any>;
    column: string;
    original: any;
    next: any;
  }) => {
    if (!selectedTable) return;
    pending.stageEdit({
      schema: selectedSchema,
      table: selectedTable,
      pks,
      column,
      original,
      next,
    });
  };

  const handleRowDelete = ({
    pks,
    snapshot,
  }: {
    pks: Record<string, any>;
    snapshot: Record<string, any>;
  }) => {
    if (!selectedTable) return;
    pending.stageDelete({
      schema: selectedSchema,
      table: selectedTable,
      pks,
      snapshot,
    });
  };

  if (!isConnected) {
    return null;
  }

  return (
    <>
    <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
      <div className="mb-4">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            openEditorTab();
            setIsMobileMenuOpen(false);
          }}
          className="w-full"
        >
          + New SQL editor
        </Button>
      </div>
      <TableList
        tables={tables}
        selectedTable={selectedTable}
        onSelect={onTableSelect}
      />
    </MobileMenu>
    <ResizableSplitter
      storageKey={`dbview-sidebar-width-${databaseName ?? 'default'}`}
      left={
        <div ref={sidebarRef}>
        <Sidebar
          tables={tables}
          selectedTable={selectedTable}
          onTableSelect={onTableSelect}
          isLoading={isLoadingTables}
          schemas={schemas}
          selectedSchema={selectedSchema}
          onSchemaChange={handleSchemaChange}
          views={views}
          materializedViews={materializedViews}
          functions={dbFunctions}
          onCreateTable={() => setIsCreateTableOpen(true)}
          onBatchExport={() => setIsBatchExportOpen(true)}
          pinnedTables={tableListPrefs.pinned}
          recentTables={tableListPrefs.recent}
          onTogglePin={tableListPrefs.togglePin}
          groupByPrefix={tableListPrefs.groupByPrefix}
          onToggleGroupByPrefix={() => tableListPrefs.setGroupByPrefix(!tableListPrefs.groupByPrefix)}
          rowCounts={tableRowCounts}
          savedQueries={savedQueries}
          onOpenSavedQuery={(q) => openEditorTab(q.query)}
          onDeleteSavedQuery={deleteSavedQuery}
        />
        </div>
      }
      right={
        <div ref={mainContentRef} className="flex-1 flex flex-col overflow-hidden">
          <Header
            isConnected={isConnected}
            databaseName={databaseName}
            tableCount={tables.length}
            onMenuToggle={() => setIsMobileMenuOpen(true)}
            onShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
          />
          <TabBar
            tabs={openTabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTab}
            onTabClose={closeTab}
            onTabCloseOthers={closeOtherTabs}
            onTabCloseAll={closeAllTabs}
            onTabReorder={reorderTabs}
            onTabTogglePin={toggleTabPin}
            actions={
              <>
                <button
                  onClick={() => openEditorTab()}
                  className="p-1.5 text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors"
                  title="New SQL editor (Alt+Q)"
                  aria-label="New SQL editor tab"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </>
            }
          />
          <MainContent>
            {error && (
              <ErrorState
                message={error}
                onRetry={selectedTable ? () => loadTableData(selectedTable, currentPage) : loadTables}
                className="mb-8"
              />
            )}
            {(() => {
              const editorTabs = openTabs.filter((t) => t.type === 'editor');
              if (editorTabs.length === 0) return null;
              return (
                <div className={isEditorTab ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
                  {isEditorTab && (
                    <Breadcrumb
                      items={[
                        { label: databaseName || 'DATABASE' },
                        { label: openTabs.find((t) => t.id === activeTabId)?.label || 'SQL' },
                      ]}
                    />
                  )}
                  {editorTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className={tab.id === activeTabId ? 'flex-1 flex flex-col min-h-0' : 'hidden'}
                    >
                      <QueryEditor
                        tabId={tab.id}
                        isActive={tab.id === activeTabId}
                        onForeignKeyClick={(args) =>
                          setFkQuery({
                            sourceColumn: args.sourceColumn,
                            fk: args.fk,
                            value: args.value,
                          })
                        }
                        onEditableTargetChange={setEditorEditableTarget}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
            {isEditorTab ? null : isQueryTab && activeTabId && queryTabResults[activeTabId] ? (
              (() => {
                const qr = queryTabResults[activeTabId];
                return (
                  <>
                    <Breadcrumb
                      items={[
                        { label: databaseName || 'Database', onClick: () => setSelectedTable(undefined) },
                        { label: 'Query Result' },
                      ]}
                    />
                    <div className="flex items-center justify-between mb-4">
                      <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-primary truncate min-w-0">
                        Query Result
                      </h1>
                      <span className="text-sm text-muted font-mono flex-shrink-0">
                        {qr.rows.length} {qr.rows.length === 1 ? 'row' : 'rows'} &middot; {qr.executionTime}ms
                      </span>
                    </div>
                    <DataTable
                      columns={qr.columns}
                      data={qr.rows}
                      isLoading={false}
                    />
                  </>
                );
              })()
            ) : selectedTable ? (
              <>
                <Breadcrumb
                  items={[
                    { label: databaseName || 'Database', onClick: () => setSelectedTable(undefined) },
                    ...(selectedSchema !== 'public' ? [{ label: selectedSchema, onClick: () => setSelectedTable(undefined) }] : []),
                    { label: selectedTable },
                  ]}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2 sm:gap-4">
                  <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-primary truncate min-w-0">
                    {selectedTable}
                  </h1>
                  <div className="flex gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
                    {!readOnlyMode && primaryKeys.length > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => dataTableRef.current?.scrollToEmptyRow()}
                        disabled={isLoading}
                      >
                        + Add row
                      </Button>
                    )}
                    {!readOnlyMode && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsCSVImportOpen(true)}
                        disabled={isLoading || schema.length === 0}
                      >
                        Import CSV
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExportOpen(true)}
                      disabled={!selectedTable || tableData.length === 0 || isLoading}
                    >
                      Export
                    </Button>
                    <button
                      onClick={() => refreshTableData()}
                      disabled={!selectedTable || isLoading}
                      className="inline-flex items-center justify-center w-8 h-8 text-secondary hover:text-primary hover:bg-bg-secondary rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Refresh table data (Alt+R)"
                      aria-label="Refresh table data"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
                {columns.length > 0 && !isLoading && (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <ColumnVisibility
                      columns={columns}
                      visibleColumns={visibleColumns}
                      onToggle={(col) =>
                        setVisibleColumns((prev) =>
                          prev.includes(col)
                            ? prev.filter((c) => c !== col)
                            : [...prev, col]
                        )
                      }
                      onShowAll={() => setVisibleColumns(columns)}
                      onHideAll={() => setVisibleColumns([])}
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search rows..."
                      className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent flex-1 min-w-0 placeholder:text-muted"
                      aria-label="Search table rows"
                    />
                  </div>
                )}
                <FilterChips
                  filters={tableFilters}
                  onRemove={removeTableFilter}
                  onClearAll={clearTableFilters}
                  onEdit={(column) => {
                    // Edit re-opens the popover via the DataTable's header
                    // context menu — let the user use right-click on the
                    // header. For chip click, we don't have a direct hook
                    // into the popover state without lifting more state.
                    // For v1 the chip click is also a remove shortcut.
                    void column;
                  }}
                />
                <DataTable
                  ref={dataTableRef}
                  columns={columns}
                  data={tableData}
                  isLoading={isLoading}
                  onSort={handleSort}
                  sortColumn={sortColumn || undefined}
                  sortDirection={sortDirection}
                  visibleColumns={visibleColumns.length > 0 ? visibleColumns : undefined}
                  searchQuery={tableSearch}
                  primaryKeys={primaryKeys}
                  columnSchema={schema}
                  schema={selectedSchema}
                  table={selectedTable}
                  layoutKey={`${databaseName ?? 'default'}.${selectedSchema}.${selectedTable}`}
                  onCellUpdate={handleCellUpdate}
                  onRowDelete={handleRowDelete}
                  foreignKeys={foreignKeys}
                  onForeignKeyClick={(args) =>
                    setFkQuery({
                      sourceColumn: args.sourceColumn,
                      fk: args.fk,
                      value: args.value,
                    })
                  }
                  filters={tableFilters}
                  onAddFilter={addTableFilter}
                  onRemoveFilter={removeTableFilter}
                  onBulkExport={(rows) => {
                    setBulkExportRows(rows);
                    setIsExportOpen(true);
                  }}
                  readOnlyMode={readOnlyMode}
                  columnTypes={columnTypes}
                  activeFormatters={allFormatters}
                />
                {(totalItems > 0 || tableFilters.length > 0) && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalItems / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    countIsEstimate={countIsEstimate}
                    filterCount={tableFilters.length}
                    unfilteredTotal={selectedTable ? tableRowCounts[selectedTable] : undefined}
                    isLoading={isLoading}
                    onItemsPerPageChange={(size) => {
                      setItemsPerPage(size);
                      setCurrentPage(1);
                    }}
                  />
                )}
                {/* Details tabs — schema, relationships, stats */}
                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex gap-1 mb-3">
                    <button
                      onClick={() => setDetailsTab(detailsTab === 'schema' ? null : 'schema')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        detailsTab === 'schema'
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted hover:text-primary hover:bg-bg-secondary'
                      }`}
                    >
                      Schema{schema.length > 0 ? ` (${schema.length})` : ''}
                    </button>
                    <button
                      onClick={() => setDetailsTab(detailsTab === 'stats' ? null : 'stats')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        detailsTab === 'stats'
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted hover:text-primary hover:bg-bg-secondary'
                      }`}
                    >
                      Stats
                    </button>
                  </div>
                  {detailsTab === 'schema' && (
                    <div className="space-y-4">
                      {!isLoadingSchema && schema.length > 0 && (
                        <TableSchema columns={schema} />
                      )}
                      <RelationshipDisplay
                        relationships={relationships}
                        indexes={indexes}
                        onNavigateToTable={onTableSelect}
                      />
                    </div>
                  )}
                  {detailsTab === 'stats' && (
                    <TableStats stats={tableStats} isLoading={isLoadingStats} />
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                title="What do you want to explore?"
                description="Pick a table from the sidebar, or open a SQL editor to run a query."
                action={
                  <Button variant="primary" size="sm" onClick={() => openEditorTab()}>
                    New SQL editor
                  </Button>
                }
              />
            )}
          </MainContent>
        </div>
      }
    />
    <PendingChangesBar onOpenReview={() => setIsReviewOpen(true)} target={reviewTarget} />
    <CommandPalette
      isOpen={isCommandPaletteOpen}
      onClose={() => setIsCommandPaletteOpen(false)}
      actions={paletteActions}
    />
    {selectedTable && (
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => {
          setIsExportOpen(false);
          setBulkExportRows(null);
        }}
        schema={selectedSchema}
        table={selectedTable}
        databaseType={databaseType}
        currentColumns={columns}
        currentRows={bulkExportRows ?? tableData}
        currentTotal={bulkExportRows ? bulkExportRows.length : totalItems}
        filters={tableFilters}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      />
    )}
    <FKSidePanel
      query={fkQuery}
      onClose={() => setFkQuery(null)}
      onOpenTable={(s, t) => {
        if (s !== selectedSchema) handleSchemaChange(s);
        handleTableSelect(t);
        setFkQuery(null);
      }}
      onFollow={(next) => setFkQuery(next)}
    />
    <TablePicker
      isOpen={isTablePickerOpen}
      onClose={() => setIsTablePickerOpen(false)}
      tables={(() => {
        // Prefer schemaMap (cross-schema). Fall back to current-schema tables.
        const fromMap = Object.entries(schemaMap).flatMap(([s, ts]) =>
          (ts as string[]).map((t) => ({ schema: s, table: t }))
        );
        if (fromMap.length > 0) return fromMap;
        return tables.map((t) => ({ schema: selectedSchema, table: t }));
      })()}
      onSelect={(entry) => {
        if (entry.schema !== selectedSchema) {
          handleSchemaChange(entry.schema);
        }
        handleTableSelect(entry.table);
      }}
    />
    {reviewTarget && (
      <ReviewSqlModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        schema={reviewTarget.schema}
        table={reviewTarget.table}
      />
    )}
    <KeyboardShortcutsHelp
      isOpen={isShortcutsHelpOpen}
      onClose={() => setIsShortcutsHelpOpen(false)}
      shortcuts={shortcuts}
    />
    {selectedTable && (
      <CSVImportDialog
        isOpen={isCSVImportOpen}
        onClose={() => setIsCSVImportOpen(false)}
        tableName={selectedTable}
        schema={selectedSchema}
        columns={schema}
        onComplete={refreshTableData}
      />
    )}
    <TableCreationWizard
      isOpen={isCreateTableOpen}
      onClose={() => setIsCreateTableOpen(false)}
      onComplete={() => loadTables()}
    />
    <BatchExportModal
      isOpen={isBatchExportOpen}
      onClose={() => setIsBatchExportOpen(false)}
      tables={tables}
      schema={selectedSchema}
      databaseType={databaseType}
    />
    </>
  );
}
