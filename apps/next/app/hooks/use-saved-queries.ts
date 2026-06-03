"use client";

import { useState, useEffect, useCallback } from "react";
import { SavedQuery } from "@/types";

const STORAGE_KEY = "dbview-saved-queries";

function loadQueries(): SavedQuery[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function persistQueries(queries: SavedQuery[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
  } catch {
    // localStorage full or unavailable
  }
}

export function useSavedQueries() {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  useEffect(() => {
    setSavedQueries(loadQueries());
  }, []);

  const saveQuery = useCallback(
    (name: string, query: string, tags: string[]) => {
      const entry: SavedQuery = {
        id: `sq_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: name.trim(),
        query: query.trim(),
        tags: tags.map((t) => t.trim()).filter(Boolean),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setSavedQueries((prev) => {
        const next = [entry, ...prev];
        persistQueries(next);
        return next;
      });
    },
    []
  );

  const updateQuery = useCallback(
    (id: string, updates: Partial<Pick<SavedQuery, "name" | "query" | "tags">>) => {
      setSavedQueries((prev) => {
        const next = prev.map((q) =>
          q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
        );
        persistQueries(next);
        return next;
      });
    },
    []
  );

  const deleteQuery = useCallback((id: string) => {
    setSavedQueries((prev) => {
      const next = prev.filter((q) => q.id !== id);
      persistQueries(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSavedQueries([]);
    persistQueries([]);
  }, []);

  return {
    savedQueries,
    saveQuery,
    updateQuery,
    deleteQuery,
    clearAll,
  };
}
