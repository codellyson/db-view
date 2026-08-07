
import { useCallback } from "react";
import { SavedQuery } from "@/types";
import { persistentStore, usePersistentStore } from "@/lib/persistent-store";

const STORAGE_KEY = "dbview-saved-queries";

const store = persistentStore<SavedQuery[]>(STORAGE_KEY, [], (raw) =>
  Array.isArray(raw) ? (raw as SavedQuery[]) : []
);

export function useSavedQueries() {
  const savedQueries = usePersistentStore(store);

  const saveQuery = useCallback((name: string, query: string, tags: string[]) => {
    const entry: SavedQuery = {
      id: `sq_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: name.trim(),
      query: query.trim(),
      tags: tags.map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.set((prev) => [entry, ...prev]);
  }, []);

  const updateQuery = useCallback(
    (id: string, updates: Partial<Pick<SavedQuery, "name" | "query" | "tags">>) => {
      store.set((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q))
      );
    },
    []
  );

  const deleteQuery = useCallback((id: string) => {
    store.set((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const clearAll = useCallback(() => store.set([]), []);

  return {
    savedQueries,
    saveQuery,
    updateQuery,
    deleteQuery,
    clearAll,
  };
}
