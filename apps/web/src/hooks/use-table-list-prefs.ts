import { useCallback, useMemo } from 'react';
import { persistentStore, usePersistentStore } from '@/lib/persistent-store';

const RECENT_LIMIT = 10;

interface Prefs {
  pinned: string[];
  recent: string[];
  groupByPrefix: boolean;
}

const EMPTY: Prefs = { pinned: [], recent: [], groupByPrefix: false };

function revive(raw: unknown): Prefs {
  const p = raw as Partial<Prefs> | null;
  if (!p || typeof p !== 'object') return EMPTY;
  return {
    pinned: Array.isArray(p.pinned) ? p.pinned : [],
    recent: Array.isArray(p.recent) ? p.recent : [],
    groupByPrefix: !!p.groupByPrefix,
  };
}

/**
 * Prefs are per database and shared by every caller for that database — the
 * dashboard and `useUrlState` both hold this hook at the same time, and with a
 * copy each, whichever recorded a table open last overwrote the other's pins.
 */
export function useTableListPrefs(databaseName: string | undefined) {
  const store = useMemo(
    () => persistentStore<Prefs>(`dbview-tablelist-${databaseName ?? ''}`, EMPTY, revive),
    [databaseName]
  );
  const prefs = usePersistentStore(store);
  // Without a database there's nothing to pin, and writing would file the
  // prefs under an empty key.
  const disabled = !databaseName;

  const togglePin = useCallback(
    (table: string) => {
      if (disabled) return;
      store.set((p) =>
        p.pinned.includes(table)
          ? { ...p, pinned: p.pinned.filter((t) => t !== table) }
          : { ...p, pinned: [...p.pinned, table] }
      );
    },
    [store, disabled]
  );

  const recordOpen = useCallback(
    (table: string) => {
      if (disabled) return;
      store.set((p) => {
        const without = p.recent.filter((t) => t !== table);
        return { ...p, recent: [table, ...without].slice(0, RECENT_LIMIT) };
      });
    },
    [store, disabled]
  );

  const setGroupByPrefix = useCallback(
    (on: boolean) => {
      if (disabled) return;
      store.set((p) => ({ ...p, groupByPrefix: on }));
    },
    [store, disabled]
  );

  return {
    pinned: prefs.pinned,
    recent: prefs.recent,
    groupByPrefix: prefs.groupByPrefix,
    togglePin,
    recordOpen,
    setGroupByPrefix,
  };
}
