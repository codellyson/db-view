"use client";

import React, { useState } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { SqlEditor } from "./sql-editor";
import type { TemplateVariable } from "@/lib/plugin-types";

interface TemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: {
    name: string;
    description: string;
    sql: string;
    tags: string[];
    dialect: "postgresql" | "mysql" | "sqlite" | "universal";
    category: "performance" | "schema" | "data" | "admin" | "custom";
    variables: TemplateVariable[];
  }) => void;
}

const DIALECT_OPTIONS = [
  { value: "universal", label: "Universal" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "custom", label: "Custom" },
  { value: "performance", label: "Performance" },
  { value: "schema", label: "Schema" },
  { value: "data", label: "Data" },
  { value: "admin", label: "Admin" },
] as const;

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sql, setSql] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [dialect, setDialect] = useState<"postgresql" | "mysql" | "sqlite" | "universal">("universal");
  const [category, setCategory] = useState<"performance" | "schema" | "data" | "admin" | "custom">("custom");

  const resetState = () => {
    setName("");
    setDescription("");
    setSql("");
    setTagsInput("");
    setDialect("universal");
    setCategory("custom");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSave = () => {
    if (!name.trim() || !sql.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Extract variables from {{variable_name}} patterns
    const varRegex = /\{\{(\w+)\}\}/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = varRegex.exec(sql)) !== null) {
      found.add(match[1]);
    }
    const variables: TemplateVariable[] = Array.from(found).map((v) => ({
      name: v,
      label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type: "text" as const,
    }));

    onSave({ name, description, sql, tags, dialect, category, variables });
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Template"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Template"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this template does"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-secondary mb-1.5">Dialect</label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value as typeof dialect)}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {DIALECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-secondary mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Tags (comma-separated)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="performance, indexes"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            SQL (use {"{{variable_name}}"} for variables)
          </label>
          <div className="border border-border rounded-md overflow-hidden">
            <SqlEditor value={sql} onChange={setSql} placeholder="SELECT ..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim() || !sql.trim()}
          >
            Save Template
          </Button>
        </div>
      </div>
    </Modal>
  );
};
