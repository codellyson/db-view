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

  if (diff < 60000) return "JUST NOW";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}M AGO`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}H AGO`;
  if (date.toDateString() === now.toDateString()) return "TODAY";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
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
      <div className="border-2 border-black dark:border-white p-6">
        <p className="text-sm font-bold uppercase font-mono text-black dark:text-white text-center">
          NO QUERY HISTORY
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-black dark:border-white">
      <div className="flex items-center justify-between p-3 bg-black dark:bg-white border-b-2 border-black dark:border-white">
        <span className="text-xs font-bold uppercase text-white dark:text-black">
          HISTORY ({entries.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs font-bold uppercase text-white dark:text-black hover:text-red-500 dark:hover:text-red-500"
        >
          CLEAR ALL
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="p-3 border-b-2 border-black dark:border-white last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer group"
            onClick={() => onSelect(entry.query)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-black dark:text-white truncate">
                  {entry.query.length > 80
                    ? entry.query.substring(0, 80) + "..."
                    : entry.query}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-bold text-black/50 dark:text-white/50">
                    {entry.executionTime}MS
                  </span>
                  <span className="text-xs font-bold text-black/50 dark:text-white/50">
                    {entry.rowCount} {entry.rowCount === 1 ? "ROW" : "ROWS"}
                  </span>
                  <span className="text-xs font-bold text-black/50 dark:text-white/50">
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
                      ? "text-yellow-300"
                      : "text-black/30 dark:text-white/30 hover:text-yellow-300"
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
                  className="px-1 text-sm text-black/30 dark:text-white/30 hover:text-red-500"
                  aria-label="Delete query from history"
                >
                  X
                </button>
              </div>
            </div>
            {entry.isFavorite && (
              <span className="inline-block mt-1 text-xs font-bold text-yellow-300">
                FAVORITE
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
