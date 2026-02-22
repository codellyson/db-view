"use client";

import React, { useState } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  generateCSVContent,
  generateJSONContent,
  generateSQLContent,
  downloadBlob,
} from "@/lib/export-utils";

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: string[];
  schema: string;
  databaseType: "postgresql" | "mysql";
}

type ExportFormat = "csv" | "json" | "sql";

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  isOpen,
  onClose,
  tables,
  schema,
  databaseType,
}) => {
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const toggleTable = (table: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) {
        next.delete(table);
      } else {
        next.add(table);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTables.size === tables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(tables));
    }
  };

  const handleExport = async () => {
    if (selectedTables.size === 0) return;

    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const tableList = Array.from(selectedTables);
      const ext = format === "csv" ? "csv" : format === "json" ? "json" : "sql";

      for (let i = 0; i < tableList.length; i++) {
        const tableName = tableList[i];
        setProgress(Math.round(((i) / tableList.length) * 100));

        // Fetch all data for this table (up to 10000 rows per batch)
        let allRows: any[] = [];
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const res = await fetch(
            `/api/table/${encodeURIComponent(tableName)}?schema=${encodeURIComponent(schema)}&limit=${batchSize}&offset=${offset}`
          );
          if (!res.ok) {
            throw new Error(`Failed to fetch data for ${tableName}`);
          }
          const data = await res.json();
          const rows = data.rows || [];
          allRows = allRows.concat(rows);
          offset += batchSize;
          hasMore = rows.length === batchSize && allRows.length < 10000;
        }

        if (allRows.length === 0) {
          // Still add an empty file
          const columns: string[] = [];
          let content = "";
          if (format === "csv") content = "";
          else if (format === "json") content = "[]";
          else content = `-- No data in ${tableName}`;
          zip.file(`${tableName}.${ext}`, content);
          continue;
        }

        const columns = Object.keys(allRows[0]);
        let content: string;

        if (format === "csv") {
          content = generateCSVContent(columns, allRows);
        } else if (format === "json") {
          content = generateJSONContent(allRows);
        } else {
          content = generateSQLContent(columns, allRows, tableName, databaseType);
        }

        zip.file(`${tableName}.${ext}`, content);
      }

      setProgress(90);
      const blob = await zip.generateAsync({ type: "blob" });
      const dateStamp = new Date().toISOString().split("T")[0];
      downloadBlob(blob, `export_${schema}_${dateStamp}.zip`, "application/zip");
      setProgress(100);

      setTimeout(() => {
        handleClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (isExporting) return;
    setSelectedTables(new Set());
    setProgress(0);
    setError(null);
    onClose();
  };

  const allSelected = selectedTables.size === tables.length && tables.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Batch Export"
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Format
          </label>
          <div className="flex gap-1">
            {(["csv", "json", "sql"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                disabled={isExporting}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  format === f
                    ? "bg-accent/10 text-accent"
                    : "text-secondary hover:text-primary hover:bg-bg-secondary"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              Tables ({selectedTables.size} of {tables.length})
            </label>
            <button
              onClick={toggleAll}
              disabled={isExporting}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto border border-border rounded-md divide-y divide-border">
            {tables.length === 0 ? (
              <div className="text-sm text-muted text-center py-6">
                No tables available
              </div>
            ) : (
              tables.map((table) => (
                <label
                  key={table}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-bg-secondary cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table)}
                    onChange={() => toggleTable(table)}
                    disabled={isExporting}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-primary font-mono truncate">
                    {table}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {isExporting && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-secondary">
              <span>Exporting...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-bg-secondary rounded-full h-1.5">
              <div
                className="bg-accent h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            {selectedTables.size > 0 && (
              <Badge variant="info">
                {selectedTables.size} {selectedTables.size === 1 ? "table" : "tables"}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={isExporting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleExport}
              isLoading={isExporting}
              disabled={selectedTables.size === 0 || isExporting}
            >
              Export ZIP
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
