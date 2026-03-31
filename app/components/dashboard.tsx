"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MainContent } from "./main-content";
import { DataTable } from "./data-table";
import { TableSchema } from "./table-schema";
import { Pagination } from "./pagination";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { ResizableSplitter } from "./resizable-splitter";
import { MobileMenu } from "./mobile-menu";
import { TableList } from "./table-list";
import { Footer } from "./footer";
import { ColumnVisibility } from "./column-visibility";
import { ExportDropdown } from "./export-dropdown";
import { Breadcrumb } from "./breadcrumb";
import { RelationshipDisplay } from "./relationship-display";
import { MutationConfirmation } from "./mutation-confirmation";
import { RowEditor } from "./row-editor";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { TableStats } from "./table-stats";
import { CSVImportDialog } from "./csv-import-dialog";
import { TableCreationWizard } from "./table-creation-wizard";
import { BatchExportModal } from "./batch-export-modal";
import { TabBar } from "./tab-bar";
import { Button } from "./ui/button";
import { useConnection } from "../contexts/connection-context";
import { useToast } from "../contexts/toast-context";
import { useDashboard } from "../contexts/dashboard-context";
import { useKeyboardShortcuts, type Shortcut } from "../hooks/use-keyboard-shortcuts";
import { exportCSV, exportJSON, exportSQL } from "@/lib/export-utils";
import { buildDisplaySQL, type MutationRequest } from "@/lib/mutation";
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
    mutateRow,
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
    isQueryTab,
    queryTabResults,
  } = useDashboard();

  const { allFormatters } = usePlugins();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    for (const col of schema) {
      types[col.name] = col.type;
    }
    return types;
  }, [schema]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingMutation, setPendingMutation] = useState<MutationRequest | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isRowEditorOpen, setIsRowEditorOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'schema' | 'stats' | null>(null);

  const onTableSelect = (table: string) => {
    handleTableSelect(table);
    setIsMobileMenuOpen(false);
  };

  const handleExportCSV = () => {
    if (!selectedTable || tableData.length === 0) return;
    exportCSV(columns, tableData, selectedTable);
    addToast("CSV exported successfully", "success");
  };

  const handleExportJSON = () => {
    if (!selectedTable || tableData.length === 0) return;
    exportJSON(columns, tableData, selectedTable);
    addToast("JSON exported successfully", "success");
  };

  const handleExportSQL = () => {
    if (!selectedTable || tableData.length === 0) return;
    exportSQL(columns, tableData, selectedTable, databaseType);
    addToast("SQL exported successfully", "success");
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
      key: 'q', alt: true, description: 'Go to query page',
      category: 'Navigation',
      action: () => router.push('/query'),
    },
    {
      key: 't', alt: true, description: 'Go to tables page',
      category: 'Navigation',
      action: () => router.push('/'),
    },
    {
      key: 'n', alt: true, description: 'Add new row',
      category: 'Editing',
      action: () => {
        if (!readOnlyMode && primaryKeys.length > 0 && selectedTable) {
          setIsRowEditorOpen(true);
        }
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
        if (pendingMutation) setPendingMutation(null);
        else if (isRowEditorOpen) setIsRowEditorOpen(false);
        else if (isShortcutsHelpOpen) setIsShortcutsHelpOpen(false);
      },
    },
  ], [readOnlyMode, primaryKeys, selectedTable, pendingMutation, isRowEditorOpen, isShortcutsHelpOpen, router]);

  useKeyboardShortcuts(shortcuts);

  const handleCellUpdate = (rowPks: Record<string, any>, column: string, newValue: any) => {
    if (!selectedTable) return;
    const request: MutationRequest = {
      type: "UPDATE",
      schema: selectedSchema,
      table: selectedTable,
      values: { [column]: newValue },
      where: rowPks,
    };
    setPendingMutation(request);
  };

  const handleRowDelete = (rowPks: Record<string, any>) => {
    if (!selectedTable) return;
    const request: MutationRequest = {
      type: "DELETE",
      schema: selectedSchema,
      table: selectedTable,
      where: rowPks,
    };
    setPendingMutation(request);
  };

  const handleRowInsert = (values: Record<string, any>) => {
    if (!selectedTable) return;
    const request: MutationRequest = {
      type: "INSERT",
      schema: selectedSchema,
      table: selectedTable,
      values,
    };
    setPendingMutation(request);
    setIsRowEditorOpen(false);
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation) return;
    setIsMutating(true);
    try {
      await mutateRow(pendingMutation);
      setPendingMutation(null);
    } catch (err: any) {
      addToast(err.message || "Mutation failed", "error");
    } finally {
      setIsMutating(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <>
    <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
      <TableList
        tables={tables}
        selectedTable={selectedTable}
        onSelect={onTableSelect}
      />
    </MobileMenu>
    <ResizableSplitter
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
        />
        </div>
      }
      right={
        <div ref={mainContentRef} className="flex-1 flex flex-col overflow-hidden">
          <Header isConnected={isConnected} databaseName={databaseName} onMenuToggle={() => setIsMobileMenuOpen(true)} onShortcutsHelp={() => setIsShortcutsHelpOpen(true)} />
          <TabBar
            tabs={openTabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTab}
            onTabClose={closeTab}
            onTabCloseOthers={closeOtherTabs}
            onTabCloseAll={closeAllTabs}
            actions={
              <>
                <button
                  onClick={() => router.push('/query')}
                  className="p-1.5 text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors"
                  title="New query (go to editor)"
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
            {isQueryTab && activeTabId && queryTabResults[activeTabId] ? (
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
                        onClick={() => setIsRowEditorOpen(true)}
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
                    <ExportDropdown
                      onExportCSV={handleExportCSV}
                      onExportJSON={handleExportJSON}
                      onExportSQL={handleExportSQL}
                      disabled={!selectedTable || tableData.length === 0 || isLoading}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsBatchExportOpen(true)}
                      disabled={tables.length === 0}
                    >
                      Batch Export
                    </Button>
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
                <DataTable
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
                  onCellUpdate={handleCellUpdate}
                  onRowDelete={handleRowDelete}
                  readOnlyMode={readOnlyMode}
                  columnTypes={columnTypes}
                  activeFormatters={allFormatters}
                />
                {totalItems > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalItems / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    countIsEstimate={countIsEstimate}
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
                description="Open the menu and pick a table to dive in."
              />
            )}
          </MainContent>
          <Footer />
        </div>
      }
    />
    {pendingMutation && (
      <MutationConfirmation
        isOpen={!!pendingMutation}
        type={pendingMutation.type}
        sql={buildDisplaySQL(pendingMutation, databaseType)}
        onConfirm={handleConfirmMutation}
        onCancel={() => setPendingMutation(null)}
        isLoading={isMutating}
      />
    )}
    {selectedTable && (
      <RowEditor
        isOpen={isRowEditorOpen}
        onClose={() => setIsRowEditorOpen(false)}
        onInsert={handleRowInsert}
        columns={schema}
        isLoading={isMutating}
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
