
import { useCallback, useMemo } from "react";
import { QueryHistoryEntry } from "@/types";
import { persistentStore, usePersistentStore } from "@/lib/persistent-store";

const STORAGE_KEY = "dbview-query-history";
const MAX_ENTRIES = 100;

// Shared across every mounted editor tab — the dashboard keeps them all
// mounted, and a per-hook copy meant each tab persisted the whole array from
// the snapshot it loaded at mount, dropping the others' runs.
const store = persistentStore<QueryHistoryEntry[]>(STORAGE_KEY, [], (raw) =>
  Array.isArray(raw) ? (raw as QueryHistoryEntry[]) : []
);

export function useQueryHistory() {
  const history = usePersistentStore(store);

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
      store.set((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    },
    []
  );

  const favoriteQuery = useCallback((id: string) => {
    store.set((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isFavorite: !e.isFavorite } : e))
    );
  }, []);

  const deleteQuery = useCallback((id: string) => {
    store.set((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => store.set([]), []);

  const sorted = useMemo(
    () => [...history.filter((e) => e.isFavorite), ...history.filter((e) => !e.isFavorite)],
    [history]
  );
  const getHistory = useCallback(() => sorted, [sorted]);

  return {
    history,
    addQuery,
    favoriteQuery,
    deleteQuery,
    clearHistory,
    getHistory,
  };
}
