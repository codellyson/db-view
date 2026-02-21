"use client";

import React, { useState, useMemo } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { SqlEditor } from "./sql-editor";
import { useConnection } from "../contexts/connection-context";
import { useDashboard } from "../contexts/dashboard-context";
import { buildCreateTableSQL, COLUMN_TYPES } from "@/lib/ddl-builder";
import { ColumnDefinition } from "@/types";

interface TableCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "name" | "columns" | "review";

const EMPTY_COLUMN: ColumnDefinition = {
  name: "",
  type: "",
  nullable: true,
  isPrimaryKey: false,
  isUnique: false,
  defaultValue: "",
};

export const TableCreationWizard: React.FC<TableCreationWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { databaseType } = useConnection();
  const { schemas, selectedSchema } = useDashboard();
  const dialect = databaseType || "postgresql";
  const types = COLUMN_TYPES[dialect];

  const [step, setStep] = useState<Step>("name");
  const [tableName, setTableName] = useState("");
  const [tableSchema, setTableSchema] = useState(selectedSchema);
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { ...EMPTY_COLUMN, type: types[0] },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep("name");
    setTableName("");
    setTableSchema(selectedSchema);
    setColumns([{ ...EMPTY_COLUMN, type: types[0] }]);
    setError(null);
    setIsCreating(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const isValidName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);
  const hasValidColumns = columns.some((c) => c.name.trim() !== "" && c.type.trim() !== "");

  const updateColumn = (index: number, updates: Partial<ColumnDefinition>) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, ...updates } : col))
    );
  };

  const addColumn = () => {
    setColumns((prev) => [...prev, { ...EMPTY_COLUMN, type: types[0] }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const generatedSQL = useMemo(() => {
    if (!tableName || !hasValidColumns) return "";
    try {
      return buildCreateTableSQL(
        {
          name: tableName,
          schema: tableSchema,
          columns: columns.filter((c) => c.name.trim() !== ""),
        },
        dialect
      );
    } catch {
      return "-- Unable to generate SQL --";
    }
  }, [tableName, tableSchema, columns, dialect, hasValidColumns]);

  const handleCreate = async () => {
    if (!generatedSQL || generatedSQL.startsWith("--")) return;
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/ddl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: generatedSQL }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create table");
      }

      onComplete();
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to create table");
    } finally {
      setIsCreating(false);
    }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(generatedSQL);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create table"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-md">
            {error}
          </div>
        )}

        {step === "name" && (
          <>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Table name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="my_table"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted font-mono"
                autoFocus
              />
              {tableName && !isValidName && (
                <p className="text-xs text-danger mt-1">
                  Must start with a letter or underscore, and contain only letters, numbers, and underscores.
                </p>
              )}
            </div>
            {schemas.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Schema
                </label>
                <select
                  value={tableSchema}
                  onChange={(e) => setTableSchema(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {schemas.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={() => setStep("columns")}
                disabled={!isValidName}
              >
                Next
              </Button>
            </div>
          </>
        )}

        {step === "columns" && (
          <>
            <div className="text-sm text-secondary mb-2">
              Define columns for <span className="font-mono font-medium text-primary">{tableSchema}.{tableName}</span>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-3">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 border border-border rounded-md bg-bg-secondary"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => updateColumn(i, { name: e.target.value })}
                        placeholder="column_name"
                        className="flex-1 px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent font-mono placeholder:text-muted"
                      />
                      <select
                        value={col.type}
                        onChange={(e) => updateColumn(i, { type: e.target.value })}
                        className="w-40 px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                      >
                        {types.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={col.isPrimaryKey}
                          onChange={(e) =>
                            updateColumn(i, {
                              isPrimaryKey: e.target.checked,
                              nullable: e.target.checked ? false : col.nullable,
                            })
                          }
                          className="rounded"
                        />
                        PK
                      </label>
                      <label className="flex items-center gap-1.5 text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={col.nullable}
                          onChange={(e) => updateColumn(i, { nullable: e.target.checked })}
                          disabled={col.isPrimaryKey}
                          className="rounded"
                        />
                        Nullable
                      </label>
                      <label className="flex items-center gap-1.5 text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={col.isUnique}
                          onChange={(e) => updateColumn(i, { isUnique: e.target.checked })}
                          className="rounded"
                        />
                        Unique
                      </label>
                      <input
                        type="text"
                        value={col.defaultValue || ""}
                        onChange={(e) => updateColumn(i, { defaultValue: e.target.value })}
                        placeholder="Default"
                        className="w-24 px-2 py-1 text-xs border border-border rounded bg-bg text-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono placeholder:text-muted"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeColumn(i)}
                    disabled={columns.length <= 1}
                    className="mt-1 p-1 text-muted hover:text-danger transition-colors disabled:opacity-30"
                    aria-label="Remove column"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={addColumn}>
              + Add column
            </Button>
            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep("name")}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep("review")}
                disabled={!hasValidColumns}
              >
                Review SQL
              </Button>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <div className="text-sm text-secondary mb-2">
              Review the generated SQL:
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <SqlEditor
                value={generatedSQL}
                onChange={() => {}}
                disabled
                placeholder=""
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep("columns")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={copySQL}>
                  Copy SQL
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  isLoading={isCreating}
                  disabled={isCreating}
                >
                  Create table
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
