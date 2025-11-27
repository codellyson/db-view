"use client";

import React, { useState, useEffect } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MainContent } from "./main-content";
import { DataTable } from "./data-table";
import { TableSchema } from "./table-schema";
import { Pagination } from "./pagination";
import { Button } from "./ui/button";
import { EmptyState } from "./empty-state";
import { ResizableSplitter } from "./resizable-splitter";
import { Footer } from "./footer";
import { useConnection } from "../contexts/connection-context";
import { ColumnInfo } from "@/types";

export function Dashboard() {
  const { isConnected, databaseName } = useConnection();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [tableData, setTableData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 100;

  useEffect(() => {
    if (isConnected) {
      loadTables();
    }
  }, [isConnected]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, currentPage);
      loadTableSchema(selectedTable);
    }
  }, [selectedTable, currentPage]);

  const loadTables = async () => {
    setIsLoadingTables(true);
    setError(null);
    try {
      const response = await fetch("/api/tables");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load tables");
      }
      const data = await response.json();
      setTables(data.tables || []);
    } catch (err: any) {
      console.error("Error loading tables:", err);
      setError(err.message || "Failed to load tables");
    } finally {
      setIsLoadingTables(false);
    }
  };

  const loadTableData = async (tableName: string, page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * itemsPerPage;
      const response = await fetch(
        `/api/table/${encodeURIComponent(
          tableName
        )}?limit=${itemsPerPage}&offset=${offset}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load table data");
      }
      const data = await response.json();
      setTableData(data.rows || []);
      setTotalItems(data.total || 0);
      if (data.rows && data.rows.length > 0) {
        setColumns(Object.keys(data.rows[0]));
      } else {
        setColumns([]);
      }
    } catch (err: any) {
      setError(err.message);
      setTableData([]);
      setColumns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTableSchema = async (tableName: string) => {
    setIsLoadingSchema(true);
    try {
      const response = await fetch(
        `/api/schema/${encodeURIComponent(tableName)}`
      );
      if (!response.ok) throw new Error("Failed to load schema");
      const data = await response.json();
      setSchema(data.schema || []);
    } catch (err: any) {
      console.error("Failed to load schema:", err);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const handleTableSelect = (table: string) => {
    setSelectedTable(table);
    setCurrentPage(1);
  };

  if (!isConnected) {
    return null;
  }

  return (
    <ResizableSplitter
      left={
        <Sidebar
          tables={tables}
          selectedTable={selectedTable}
          onTableSelect={handleTableSelect}
          isLoading={isLoadingTables}
        />
      }
      right={
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header isConnected={isConnected} databaseName={databaseName} />
          <MainContent>
            {error && (
              <div className="mb-8 p-4 bg-red-500 border-2 border-black text-white font-bold uppercase">
                {error}
              </div>
            )}
            {selectedTable ? (
              <>
                <div className="flex justify-between items-center mb-8 gap-4">
                  <h1 className="text-4xl font-bold uppercase tracking-tight text-black truncate flex-1 min-w-0">
                    {selectedTable}
                  </h1>
                  <Button variant="secondary" className="flex-shrink-0">
                    EXPORT
                  </Button>
                </div>
                {!isLoadingSchema && schema.length > 0 && (
                  <TableSchema columns={schema} />
                )}
                <DataTable
                  columns={columns}
                  data={tableData}
                  isLoading={isLoading}
                />
                {totalItems > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalItems / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
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
  );
}
