import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistentStore, resetPersistentStores } from './persistent-store';

beforeEach(() => {
  const data = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  (globalThis as any).window = { addEventListener: () => {} };
  resetPersistentStores();
});

describe('persistentStore', () => {
  it('hands every caller for a key the same store', () => {
    expect(persistentStore('k', [])).toBe(persistentStore('k', []));
    expect(persistentStore('k', [])).not.toBe(persistentStore('other', []));
  });

  // The split-brain regression: two components holding the same key each
  // loaded a snapshot at mount and wrote the whole value back, so the last
  // writer discarded what the other had recorded.
  it('keeps both writers’ entries when two holders append', () => {
    const a = persistentStore<string[]>('log', []);
    const b = persistentStore<string[]>('log', []);
    a.getSnapshot();
    b.getSnapshot();

    a.set((prev) => [...prev, 'from-a']);
    b.set((prev) => [...prev, 'from-b']);

    expect(b.getSnapshot()).toEqual(['from-a', 'from-b']);
    expect(a.getSnapshot()).toEqual(['from-a', 'from-b']);
    expect(JSON.parse(localStorage.getItem('log')!)).toEqual(['from-a', 'from-b']);
  });

  it('notifies subscribers registered through any reference to the key', () => {
    const a = persistentStore<number>('n', 0);
    const b = persistentStore<number>('n', 0);
    const seen = vi.fn();
    b.subscribe(seen);

    a.set(1);

    expect(seen).toHaveBeenCalledTimes(1);
    expect(b.getSnapshot()).toBe(1);
  });

  it('stops notifying after unsubscribe', () => {
    const store = persistentStore<number>('n', 0);
    const seen = vi.fn();
    store.subscribe(seen)();
    store.set(1);
    expect(seen).not.toHaveBeenCalled();
  });

  it('does not notify when the value is unchanged', () => {
    const store = persistentStore<number>('n', 0);
    const seen = vi.fn();
    store.subscribe(seen);
    store.set(0);
    expect(seen).not.toHaveBeenCalled();
  });

  it('returns a stable snapshot reference between writes', () => {
    const store = persistentStore<string[]>('list', []);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    store.set(['x']);
    expect(store.getSnapshot()).not.toBe(first);
  });

  it('reads what a previous session persisted', () => {
    localStorage.setItem('list', JSON.stringify(['saved']));
    expect(persistentStore<string[]>('list', []).getSnapshot()).toEqual(['saved']);
  });

  it('falls back on a missing or corrupt entry', () => {
    expect(persistentStore<string[]>('missing', ['fallback']).getSnapshot()).toEqual(['fallback']);
    localStorage.setItem('bad', '{not json');
    expect(persistentStore<string[]>('bad', ['fallback']).getSnapshot()).toEqual(['fallback']);
  });

  it('runs stored values through revive', () => {
    localStorage.setItem('shape', JSON.stringify({ pinned: 'not-an-array' }));
    const store = persistentStore('shape', { pinned: [] as string[] }, (raw) => ({
      pinned: Array.isArray((raw as any)?.pinned) ? (raw as any).pinned : [],
    }));
    expect(store.getSnapshot()).toEqual({ pinned: [] });
  });

  it('keeps the in-memory value when persisting fails', () => {
    const store = persistentStore<number>('n', 0);
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    store.set(7);
    expect(store.getSnapshot()).toBe(7);
  });

  it('isolates per-database keys', () => {
    const alpha = persistentStore<string[]>('dbview-tablelist-alpha', []);
    const beta = persistentStore<string[]>('dbview-tablelist-beta', []);
    alpha.set(['users']);
    expect(beta.getSnapshot()).toEqual([]);
  });
});
