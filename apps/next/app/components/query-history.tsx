"use client";

import React, { useMemo, useState } from "react";
import { QueryHistoryEntry } from "@/types";
import { fuzzyMatch } from "@/lib/fuzzy";

interface QueryHistoryProps {
  entries: QueryHistoryEntry[];
  onSelect: (query: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  /** Optional: open the SaveQueryDialog with the selected entry's query. */
  onSave?: (query: string) => void;
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
  onSave,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return entries;
    return entries
      .map((e) => ({ entry: e, ...fuzzyMatch(search, e.query) }))
      .filter((x) => x.matched)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.entry);
  }, [entries, search]);

  if (entries.length === 0) {
    return (
      <div className="border border-border rounded-lg p-6">
        <p className="text-sm text-muted text-center">No query history</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-bg-secondary border-b border-border">
        <span className="text-xs font-medium text-secondary flex-shrink-0">
          History ({entries.length})
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search history…"
          className="flex-1 min-w-0 px-2 py-1 text-xs border border-border rounded bg-bg text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Search query history"
        />
        <button
          onClick={onClear}
          className="text-xs font-medium text-secondary hover:text-danger transition-colors flex-shrink-0"
        >
          Clear
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted">No matches.</div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-bg-secondary cursor-pointer group transition-colors"
              onClick={() => onSelect(entry.query)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-primary truncate">
                    {entry.query.length > 80 ? entry.query.substring(0, 80) + "..." : entry.query}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted">{entry.executionTime}ms</span>
                    <span className="text-xs text-muted">
                      {entry.rowCount} {entry.rowCount === 1 ? "row" : "rows"}
                    </span>
                    <span className="text-xs text-muted">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFavorite(entry.id);
                    }}
                    className={`px-1 text-sm ${
                      entry.isFavorite ? "text-warning" : "text-muted hover:text-warning"
                    }`}
                    aria-label={entry.isFavorite ? "Unfavorite query" : "Favorite query"}
                  >
                    {entry.isFavorite ? "★" : "☆"}
                  </button>
                  {onSave && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSave(entry.query);
                      }}
                      className="px-1 text-xs text-muted hover:text-accent transition-colors"
                      title="Save query…"
                      aria-label="Save query"
                    >
                      Save
                    </button>
                  )}
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
                <span className="inline-block mt-1 text-xs text-warning">Favorite</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
