"use client";

import React, { useState, useMemo } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { usePlugins } from "../hooks/use-plugins";
import type { QueryTemplate } from "@/lib/plugin-types";

interface TemplateBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (sql: string) => void;
  dialect: "postgresql" | "mysql" | "sqlite";
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "performance", label: "Performance" },
  { key: "schema", label: "Schema" },
  { key: "data", label: "Data" },
  { key: "admin", label: "Admin" },
  { key: "custom", label: "Custom" },
] as const;

export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  isOpen,
  onClose,
  onInsert,
  dialect,
}) => {
  const { getTemplates, resolveTemplate } = usePlugins();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<QueryTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const templates = useMemo(
    () => getTemplates(dialect),
    [getTemplates, dialect]
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [templates, selectedCategory, searchQuery]);

  const handleSelectTemplate = (template: QueryTemplate) => {
    setSelectedTemplate(template);
    const vars: Record<string, string> = {};
    for (const v of template.variables) {
      vars[v.name] = v.defaultValue || "";
    }
    setVariables(vars);
  };

  const handleInsert = () => {
    if (!selectedTemplate) return;
    const sql = resolveTemplate(selectedTemplate, variables);
    onInsert(sql);
    handleClose();
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setSearchQuery("");
    setSelectedCategory("all");
    setVariables({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Query Templates"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {!selectedTemplate ? (
          <>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
            />
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedCategory === cat.key
                      ? "bg-accent/10 text-accent"
                      : "text-secondary hover:text-primary hover:bg-bg-secondary"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredTemplates.length === 0 ? (
                <div className="text-sm text-muted text-center py-8">
                  No templates found
                </div>
              ) : (
                filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className="w-full text-left p-3 border border-border rounded-md hover:bg-bg-secondary transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-primary">{t.name}</span>
                      <div className="flex items-center gap-1.5">
                        {t.dialect !== "universal" && (
                          <Badge variant="info">{t.dialect === "postgresql" ? "PG" : "MySQL"}</Badge>
                        )}
                        {!t.isBuiltIn && <Badge variant="warning">Custom</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-secondary mb-1.5">{t.description}</p>
                    <div className="flex gap-1 flex-wrap">
                      {t.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
                Back
              </Button>
              <span className="text-sm font-medium text-primary">{selectedTemplate.name}</span>
            </div>
            <p className="text-xs text-secondary">{selectedTemplate.description}</p>
            {selectedTemplate.variables.length > 0 && (
              <div className="space-y-3 border border-border rounded-md p-3 bg-bg-secondary">
                <div className="text-xs font-medium text-secondary">Variables</div>
                {selectedTemplate.variables.map((v) => (
                  <div key={v.name}>
                    <label className="block text-xs text-secondary mb-1">{v.label}</label>
                    {v.type === "select" && v.options ? (
                      <select
                        value={variables[v.name] || ""}
                        onChange={(e) =>
                          setVariables((prev) => ({ ...prev, [v.name]: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {v.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={variables[v.name] || ""}
                        onChange={(e) =>
                          setVariables((prev) => ({ ...prev, [v.name]: e.target.value }))
                        }
                        placeholder={v.defaultValue || v.name}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent font-mono placeholder:text-muted"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="border border-border rounded-md p-3 bg-bg-secondary">
              <div className="text-xs font-medium text-secondary mb-1">Preview</div>
              <pre className="text-xs font-mono text-primary whitespace-pre-wrap">
                {resolveTemplate(selectedTemplate, variables)}
              </pre>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedTemplate(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleInsert}>
                Insert into Editor
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
