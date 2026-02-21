"use client";

import React from "react";
import { QueryHistoryEntry } from "@/types";
import { Button } from "./ui/button";

interface QueryHistoryProps {
  entries: QueryHistoryEntry[];
  onSelect: (query: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (date.toDateString() === now.toDateString()) return "Today";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const QueryHistory: React.FC<QueryHistoryProps> = ({
  entries,
  onSelect,
  onFavorite,
  onDelete,
  onClear,
}) => {
  if (entries.length === 0) {
    return (
      <div className="border border-border rounded-lg p-6">
        <p className="text-sm text-muted text-center">
          No query history
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border">
        <span className="text-xs font-medium text-secondary">
          History ({entries.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs font-medium text-secondary hover:text-danger transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-bg-secondary cursor-pointer group transition-colors"
            onClick={() => onSelect(entry.query)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-primary truncate">
                  {entry.query.length > 80
                    ? entry.query.substring(0, 80) + "..."
                    : entry.query}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted">
                    {entry.executionTime}ms
                  </span>
                  <span className="text-xs text-muted">
                    {entry.rowCount} {entry.rowCount === 1 ? "row" : "rows"}
                  </span>
                  <span className="text-xs text-muted">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavorite(entry.id);
                  }}
                  className={`px-1 text-sm ${
                    entry.isFavorite
                      ? "text-warning"
                      : "text-muted hover:text-warning"
                  }`}
                  aria-label={entry.isFavorite ? "Unfavorite query" : "Favorite query"}
                >
                  {entry.isFavorite ? "\u2605" : "\u2606"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                  className="px-1 text-sm text-muted hover:text-danger transition-colors"
                  aria-label="Delete query from history"
                >
                  &times;
                </button>
              </div>
            </div>
            {entry.isFavorite && (
              <span className="inline-block mt-1 text-xs text-warning">
                Favorite
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
