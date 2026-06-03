"use client";

import React, { useState, useMemo } from "react";
import { SavedQuery } from "@/types";

interface SavedQueriesPanelProps {
  queries: SavedQuery[];
  onSelect: (query: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function formatDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (date.toDateString() === now.toDateString()) return "Today";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const SavedQueriesPanel: React.FC<SavedQueriesPanelProps> = ({
  queries,
  onSelect,
  onDelete,
  onClear,
}) => {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    queries.forEach((q) => q.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [queries]);

  const filtered = useMemo(() => {
    if (!activeTag) return queries;
    return queries.filter((q) => q.tags.includes(activeTag));
  }, [queries, activeTag]);

  if (queries.length === 0) {
    return (
      <div className="border border-border rounded-lg p-6">
        <p className="text-sm text-muted text-center">No saved queries</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border">
        <span className="text-xs font-medium text-secondary">
          Saved ({queries.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs font-medium text-secondary hover:text-danger transition-colors"
        >
          Clear all
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors flex-shrink-0 ${
              activeTag === null
                ? "bg-accent/10 text-accent"
                : "bg-bg-secondary text-secondary hover:text-primary"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors flex-shrink-0 ${
                activeTag === tag
                  ? "bg-accent/10 text-accent"
                  : "bg-bg-secondary text-secondary hover:text-primary"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-bg-secondary cursor-pointer group transition-colors"
            onClick={() => onSelect(entry.query)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">
                  {entry.name}
                </p>
                <p className="text-xs font-mono text-muted truncate mt-0.5">
                  {entry.query.length > 80
                    ? entry.query.substring(0, 80) + "..."
                    : entry.query}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-[10px] rounded-full bg-bg-secondary text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-xs text-muted">
                    {formatDate(entry.updatedAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.id);
                }}
                className="px-1 text-sm text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                aria-label="Delete saved query"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
