
import React, { useState, useMemo, useCallback, useRef } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { SqlEditor } from "./sql-editor";
import { useConnection } from "../contexts/connection-context";
import { useDashboardState } from "../contexts/dashboard-context";
import { buildCreateTableSQL, COLUMN_TYPES } from "@/lib/ddl-builder";
import { db } from "@/lib/db";
import { ColumnDefinition } from "@/types";
import { Trash2 } from 'lucide-react';
import { Checkbox, Input } from '@codellyson/justui/react';

interface TableCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "name" | "columns" | "review";

interface ColumnWithId extends ColumnDefinition {
  id: string;
}

let columnIdCounter = 0;
function nextColumnId(): string {
  return `col_${++columnIdCounter}`;
}

export const TableCreationWizard: React.FC<TableCreationWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { databaseType } = useConnection();
  const { schemas, selectedSchema } = useDashboardState();
  const dialect = databaseType || "postgresql";
  const types = COLUMN_TYPES[dialect];

  const makeColumn = useCallback((): ColumnWithId => ({
    id: nextColumnId(),
    name: "",
    type: types[0],
    nullable: true,
    isPrimaryKey: false,
    isUnique: false,
    defaultValue: "",
  }), [types]);

  const [step, setStep] = useState<Step>("name");
  const [tableName, setTableName] = useState("");
  const [tableSchema, setTableSchema] = useState(selectedSchema);
  const [columns, setColumns] = useState<ColumnWithId[]>(() => [makeColumn()]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep("name");
    setTableName("");
    setTableSchema(selectedSchema);
    setColumns([makeColumn()]);
    setError(null);
    setIsCreating(false);
  }, [selectedSchema, makeColumn]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const isValidName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);
  const hasValidColumns = columns.some((c) => c.name.trim() !== "" && c.type.trim() !== "");

  const updateColumn = (index: number, updates: Partial<ColumnDefinition>) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, ...updates } : col))
    );
  };

  const addColumn = () => {
    setColumns((prev) => [...prev, makeColumn()]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag-to-reorder columns
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleColDragStart = (e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleColDragEnd = (e: React.DragEvent) => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleColDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      setDragOverIndex(index);
    }
  };

  const handleColDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = dragIndexRef.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    setColumns((prev) => {
      const newCols = [...prev];
      const [moved] = newCols.splice(sourceIndex, 1);
      newCols.splice(targetIndex, 0, moved);
      return newCols;
    });
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  const generatedSQL = useMemo(() => {
    if (!tableName || !hasValidColumns) return "";
    try {
      return buildCreateTableSQL(
        {
          name: tableName,
          schema: tableSchema,
          columns: columns
            .filter((c) => c.name.trim() !== "")
            .map(({ id, ...rest }) => rest),
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
      await db.ddl(generatedSQL);

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
      width={672}
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
              <Input
                value={tableName}
                onChange={setTableName}
                placeholder="my_table"
                containerClassName="w-full"
                className="font-mono"
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
                <Select
                  inputSize="md"
                  value={tableSchema}
                  onChange={(v) => setTableSchema(v)}
                >
                  {schemas.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
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
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleColDragStart(e, i)}
                  onDragEnd={handleColDragEnd}
                  onDragOver={(e) => handleColDragOver(e, i)}
                  onDrop={(e) => handleColDrop(e, i)}
                  className={`flex items-start gap-2 p-3 border border-border rounded-md bg-bg-secondary cursor-grab active:cursor-grabbing ${
                    dragOverIndex === i ? 'border-accent bg-accent/5' : ''
                  }`}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={col.name}
                        onChange={(v) => updateColumn(i, { name: v })}
                        placeholder="column_name"
                        containerClassName="flex-1"
                        className="font-mono"
                      />
                      <Select
                        containerClassName="w-40"
                        className="font-mono"
                        value={col.type}
                        onChange={(v) => updateColumn(i, { type: v })}
                      >
                        {types.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <Checkbox
                        checked={col.isPrimaryKey}
                        onChange={(checked) =>
                          updateColumn(i, {
                            isPrimaryKey: checked === true,
                            nullable: checked === true ? false : col.nullable,
                          })
                        }
                        label={<span className="text-xs text-secondary">PK</span>}
                      />
                      <Checkbox
                        checked={col.nullable}
                        onChange={(checked) => updateColumn(i, { nullable: checked === true })}
                        disabled={col.isPrimaryKey}
                        label={<span className="text-xs text-secondary">Nullable</span>}
                      />
                      <Checkbox
                        checked={col.isUnique}
                        onChange={(checked) => updateColumn(i, { isUnique: checked === true })}
                        label={<span className="text-xs text-secondary">Unique</span>}
                      />
                      <Input
                        value={col.defaultValue || ""}
                        onChange={(v) => updateColumn(i, { defaultValue: v })}
                        placeholder="Default"
                        containerClassName="w-24"
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeColumn(i)}
                    disabled={columns.length <= 1}
                    className="mt-1 p-1 text-muted hover:text-danger transition-colors disabled:opacity-30"
                    aria-label="Remove column"
                  >
                    <Trash2 className="h-4 w-4" />
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
