"use client";

import React, { useState } from "react";
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
import { useConnection } from "../contexts/connection-context";
import { useToast } from "../contexts/toast-context";
import { useDashboard } from "../contexts/dashboard-context";
import { exportCSV, exportJSON, exportSQL } from "@/lib/export-utils";

export function Dashboard() {
  const { isConnected, databaseName } = useConnection();
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
  } = useDashboard();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const onTableSelect = (table: string) => {
    handleTableSelect(table);
    setIsMobileMenuOpen(false);
  };

  const handleExportCSV = () => {
    if (!selectedTable || tableData.length === 0) return;
    exportCSV(columns, tableData, selectedTable);
    addToast("CSV EXPORTED SUCCESSFULLY", "success");
  };

  const handleExportJSON = () => {
    if (!selectedTable || tableData.length === 0) return;
    exportJSON(columns, tableData, selectedTable);
    addToast("JSON EXPORTED SUCCESSFULLY", "success");
  };

  const handleExportSQL = () => {
    if (!selectedTable || tableData.length === 0) return;
    exportSQL(columns, tableData, selectedTable);
    addToast("SQL EXPORTED SUCCESSFULLY", "success");
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
        />
      }
      right={
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header isConnected={isConnected} databaseName={databaseName} onMenuToggle={() => setIsMobileMenuOpen(true)} />
          <MainContent>
            {error && (
              <ErrorState
                message={error}
                onRetry={selectedTable ? () => loadTableData(selectedTable, currentPage) : loadTables}
                className="mb-8"
              />
            )}
            {selectedTable ? (
              <>
                <Breadcrumb
                  items={[
                    { label: databaseName || 'DATABASE', onClick: () => setSelectedTable(undefined) },
                    ...(selectedSchema !== 'public' ? [{ label: selectedSchema, onClick: () => setSelectedTable(undefined) }] : []),
                    { label: selectedTable },
                  ]}
                />
                <div className="flex justify-between items-center mb-8 gap-4">
                  <h1 className="text-4xl font-bold uppercase tracking-tight text-black dark:text-white truncate flex-1 min-w-0">
                    {selectedTable}
                  </h1>
                  <ExportDropdown
                    onExportCSV={handleExportCSV}
                    onExportJSON={handleExportJSON}
                    onExportSQL={handleExportSQL}
                    disabled={!selectedTable || tableData.length === 0 || isLoading}
                  />
                </div>
                {!isLoadingSchema && schema.length > 0 && (
                  <TableSchema columns={schema} />
                )}
                <RelationshipDisplay
                  relationships={relationships}
                  indexes={indexes}
                  onNavigateToTable={onTableSelect}
                />
                {columns.length > 0 && !isLoading && (
                  <div className="flex flex-wrap items-center gap-2 mb-4">
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
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="SEARCH ROWS..."
                      className="px-4 py-2 text-sm font-bold uppercase font-mono border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:shadow-[0_0_0_2px_black] dark:focus:shadow-[0_0_0_2px_white] flex-1 min-w-[150px]"
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
                />
                {totalItems > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalItems / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    countIsEstimate={countIsEstimate}
                  />
                )}
              </>
            ) : (
              <EmptyState
                title="No table selected"
                description="Select a table from the sidebar to view its data."
              />
            )}
          </MainContent>
          <Footer />
        </div>
      }
    />
    </>
  );
}
