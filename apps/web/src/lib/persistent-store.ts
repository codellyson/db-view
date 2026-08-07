import { useSyncExternalStore } from 'react';

/**
 * A single, shared source of truth for one localStorage key.
 *
 * Hand-rolled `useState` + persist-on-write hooks give every component that
 * calls them an independent copy of the same key. Two SQL editor tabs, or the
 * dashboard and the settings modal, each load a snapshot at mount and then
 * write the whole value back — so the last writer silently discards whatever
 * the others recorded, and edits made in one never reach the other.
 *
 * Stores are module-lifetime singletons keyed by their storage key, so every
 * subscriber reads and writes the same value and re-renders together.
 */
export interface PersistentStore<T> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): T;
  set(updater: T | ((prev: T) => T)): void;
}

const registry = new Map<string, PersistentStore<unknown>>();

function createStore<T>(key: string, fallback: T, revive: (raw: unknown) => T): PersistentStore<T> {
  const listeners = new Set<() => void>();
  let value: T;
  let loaded = false;

  const read = (): T => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : revive(JSON.parse(raw));
    } catch {
      // missing, corrupt, or storage disabled — start from the fallback
      return fallback;
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const store: PersistentStore<T> = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      if (!loaded) {
        value = read();
        loaded = true;
      }
      return value;
    },
    set(updater) {
      const prev = store.getSnapshot();
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      if (Object.is(next, prev)) return;
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // quota exceeded or storage disabled — keep the in-memory value
      }
      emit();
    },
  };

  // `storage` only fires in *other* documents, so this is how a second app
  // window learns about the first one's writes.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== key) return;
      value = read();
      loaded = true;
      emit();
    });
  }

  return store;
}

/**
 * The store for `key`, created on first use. The first caller's `fallback` and
 * `revive` win — a key is expected to have one owner.
 */
export function persistentStore<T>(
  key: string,
  fallback: T,
  revive: (raw: unknown) => T = (raw) => raw as T
): PersistentStore<T> {
  const existing = registry.get(key);
  if (existing) return existing as PersistentStore<T>;
  const store = createStore(key, fallback, revive);
  registry.set(key, store as PersistentStore<unknown>);
  return store;
}

export function usePersistentStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** Test seam: drops cached stores so a fresh one reads current storage. */
export function resetPersistentStores(): void {
  registry.clear();
}
