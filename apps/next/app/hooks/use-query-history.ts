"use client";

import { useState, useEffect, useCallback } from "react";
import { QueryHistoryEntry } from "@/types";

const STORAGE_KEY = "dbview-query-history";
const MAX_ENTRIES = 100;

function loadHistory(): QueryHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: QueryHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable
  }
}

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addQuery = useCallback(
    (query: string, executionTime: number, rowCount: number) => {
      const entry: QueryHistoryEntry = {
        id: `qh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        query: query.trim(),
        executionTime,
        rowCount,
        timestamp: Date.now(),
        isFavorite: false,
      };

      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_ENTRIES);
        saveHistory(next);
        return next;
      });
    },
    []
  );

  const favoriteQuery = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.map((e) =>
        e.id === id ? { ...e, isFavorite: !e.isFavorite } : e
      );
      saveHistory(next);
      return next;
    });
  }, []);

  const deleteQuery = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const getHistory = useCallback(() => {
    const favorites = history.filter((e) => e.isFavorite);
    const rest = history.filter((e) => !e.isFavorite);
    return [...favorites, ...rest];
  }, [history]);

  return {
    history,
    addQuery,
    favoriteQuery,
    deleteQuery,
    clearHistory,
    getHistory,
  };
}
