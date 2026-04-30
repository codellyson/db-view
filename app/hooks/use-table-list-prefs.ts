'use client';

import { useCallback, useEffect, useState } from 'react';

const RECENT_LIMIT = 10;

interface Prefs {
  pinned: string[];
  recent: string[];
  groupByPrefix: boolean;
}

const EMPTY: Prefs = { pinned: [], recent: [], groupByPrefix: false };

function key(databaseName: string | undefined): string | null {
  if (!databaseName) return null;
  return `dbview-tablelist-${databaseName}`;
}

function load(databaseName: string | undefined): Prefs {
  const k = key(databaseName);
  if (!k || typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      groupByPrefix: !!parsed.groupByPrefix,
    };
  } catch {
    return EMPTY;
  }
}

function save(databaseName: string | undefined, prefs: Prefs) {
  const k = key(databaseName);
  if (!k || typeof window === 'undefined') return;
  try {
    localStorage.setItem(k, JSON.stringify(prefs));
  } catch {
    // quota — ignore
  }
}

export function useTableListPrefs(databaseName: string | undefined) {
  const [prefs, setPrefs] = useState<Prefs>(EMPTY);

  // Reload when the database changes.
  useEffect(() => {
    setPrefs(load(databaseName));
  }, [databaseName]);

  useEffect(() => {
    save(databaseName, prefs);
  }, [databaseName, prefs]);

  const togglePin = useCallback((table: string) => {
    setPrefs((p) =>
      p.pinned.includes(table)
        ? { ...p, pinned: p.pinned.filter((t) => t !== table) }
        : { ...p, pinned: [...p.pinned, table] }
    );
  }, []);

  const recordOpen = useCallback((table: string) => {
    setPrefs((p) => {
      const without = p.recent.filter((t) => t !== table);
      return { ...p, recent: [table, ...without].slice(0, RECENT_LIMIT) };
    });
  }, []);

  const setGroupByPrefix = useCallback((on: boolean) => {
    setPrefs((p) => ({ ...p, groupByPrefix: on }));
  }, []);

  return {
    pinned: prefs.pinned,
    recent: prefs.recent,
    groupByPrefix: prefs.groupByPrefix,
    togglePin,
    recordOpen,
    setGroupByPrefix,
  };
}
