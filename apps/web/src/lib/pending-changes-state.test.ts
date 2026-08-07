import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildMutationRequests,
  countPending,
  historyReducer,
  readPersisted,
  reducer,
  rowKeyFromPks,
  writePersisted,
  INITIAL_HISTORY,
  type Action,
  type HistoryAction,
  type HistoryState,
  type State,
} from './pending-changes-state';

const apply = (h: HistoryState, ...actions: HistoryAction[]) =>
  actions.reduce(historyReducer, h);

const del = (id: number): Action => ({
  type: 'STAGE_DELETE',
  schema: 'public',
  table: 'users',
  pks: { id },
  snapshot: { id, name: `row ${id}` },
});

const edit = (id: number, next: string): Action => ({
  type: 'STAGE_EDIT',
  schema: 'public',
  table: 'users',
  pks: { id },
  column: 'name',
  original: 'before',
  next,
});

describe('reducer', () => {
  it('collapses multi-cell edits and keeps the first original', () => {
    let s: State = { db: 'app', byTable: {} };
    s = reducer(s, edit(1, 'first'));
    s = reducer(s, edit(1, 'second'));
    const changes = s.byTable['public.users'].edits[rowKeyFromPks({ id: 1 })].changes;
    expect(changes.name).toEqual({ original: 'before', next: 'second' });
  });

  it('drops the table entry once its last change is reverted', () => {
    let s: State = { db: 'app', byTable: {} };
    s = reducer(s, edit(1, 'changed'));
    s = reducer(s, edit(1, 'before'));
    expect(s.byTable).toEqual({});
  });

  it('returns the same state for a no-op so it never records history', () => {
    const s: State = { db: 'app', byTable: {} };
    expect(reducer(s, { type: 'DISCARD_ALL' })).toBe(s);
    expect(reducer(s, { type: 'DISCARD_TABLE', schema: 'public', table: 'users' })).toBe(s);
  });

  it('orders mutations deletes → updates → inserts', () => {
    let s: State = { db: 'app', byTable: {} };
    s = reducer(s, edit(1, 'changed'));
    s = reducer(s, {
      type: 'STAGE_INSERT',
      schema: 'public',
      table: 'users',
      tempId: 't1',
      values: { name: 'new' },
    });
    s = reducer(s, del(2));
    expect(buildMutationRequests(s, 'public', 'users').map((r) => r.type)).toEqual([
      'DELETE',
      'UPDATE',
      'INSERT',
    ]);
  });
});

describe('undo history', () => {
  // The bulk-delete regression: `deleteSelected` stages one row per dispatch
  // in a single tick. History used to be captured from a closure, so all five
  // steps recorded the same pre-batch state — the first undo reverted the
  // whole batch and the remaining four were silent no-ops.
  it('records one step per staged row when a batch dispatches in a single tick', () => {
    const h = apply(INITIAL_HISTORY, del(1), del(2), del(3), del(4), del(5));
    expect(countPending(h.present)).toBe(5);
    expect(h.past).toHaveLength(5);

    const counts = [4, 3, 2, 1, 0].map((_, i) => {
      const undone = apply(h, ...Array(i + 1).fill({ type: 'UNDO' as const }));
      return countPending(undone.present);
    });
    expect(counts).toEqual([4, 3, 2, 1, 0]);
  });

  it('redoes back to the batched state step by step', () => {
    const staged = apply(INITIAL_HISTORY, del(1), del(2), del(3));
    const rewound = apply(staged, { type: 'UNDO' }, { type: 'UNDO' }, { type: 'UNDO' });
    expect(countPending(rewound.present)).toBe(0);
    const replayed = apply(rewound, { type: 'REDO' }, { type: 'REDO' }, { type: 'REDO' });
    expect(countPending(replayed.present)).toBe(3);
    expect(replayed.present).toEqual(staged.present);
  });

  it('does not record a step for an action that changes nothing', () => {
    const h = apply(INITIAL_HISTORY, del(1), { type: 'DISCARD_TABLE', schema: 'x', table: 'y' });
    expect(h.past).toHaveLength(1);
  });

  it('caps the stack and still undoes the most recent step', () => {
    const many = Array.from({ length: 60 }, (_, i) => del(i));
    const h = apply(INITIAL_HISTORY, ...many);
    expect(h.past).toHaveLength(50);
    expect(countPending(apply(h, { type: 'UNDO' }).present)).toBe(59);
  });

  it('starts a new timeline on hydrate and after a save', () => {
    const staged = apply(INITIAL_HISTORY, del(1), del(2));
    const switched = apply(staged, { type: 'HYDRATE', state: { db: 'other', byTable: {} } });
    expect(switched.past).toEqual([]);
    expect(switched.future).toEqual([]);
    // Undoing across the switch would re-stage the previous database's rows.
    expect(apply(switched, { type: 'UNDO' }).present.byTable).toEqual({});

    const saved = apply(staged, { type: 'CLEAR_AFTER_SAVE', schema: 'public', table: 'users' });
    expect(saved.past).toEqual([]);
    expect(countPending(saved.present)).toBe(0);
  });

  it('leaves history untouched when there is nothing to undo or redo', () => {
    expect(historyReducer(INITIAL_HISTORY, { type: 'UNDO' })).toBe(INITIAL_HISTORY);
    expect(historyReducer(INITIAL_HISTORY, { type: 'REDO' })).toBe(INITIAL_HISTORY);
  });
});

describe('per-database persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  // The cross-database leak: hydrating a database with nothing saved used to
  // early-return, leaving the previous database's staged rows in state — which
  // the persist effect then filed under the new database's key.
  it('hydrates an empty slate for a database with nothing saved', () => {
    const staged = reducer({ db: 'alpha', byTable: {} }, del(1));
    writePersisted(staged);

    const switched = readPersisted('beta');
    expect(switched).toEqual({ db: 'beta', byTable: {} });
    expect(countPending(switched)).toBe(0);
  });

  it('never writes one database’s rows under another’s key', () => {
    const staged = reducer({ db: 'alpha', byTable: {} }, del(1));
    writePersisted(staged);
    writePersisted({ ...staged, db: null });

    expect(countPending(readPersisted('alpha'))).toBe(1);
    expect(countPending(readPersisted('beta'))).toBe(0);
  });

  it('round-trips staged rows for the database they belong to', () => {
    const staged = reducer({ db: 'alpha', byTable: {} }, edit(1, 'changed'));
    writePersisted(staged);
    expect(readPersisted('alpha')).toEqual(staged);
  });

  it('clears the entry once the last staged row is gone', () => {
    const staged = reducer({ db: 'alpha', byTable: {} }, del(1));
    writePersisted(staged);
    writePersisted({ db: 'alpha', byTable: {} });
    expect(localStorage.getItem('dbview-pending-alpha')).toBeNull();
  });

  it('reads legacy entries written before the db stamp', () => {
    localStorage.setItem(
      'dbview-pending-alpha',
      JSON.stringify({ byTable: { 'public.users': { edits: {}, inserts: [{ tempId: 't', values: {} }], deletes: {} } } })
    );
    const loaded = readPersisted('alpha');
    expect(loaded.db).toBe('alpha');
    expect(countPending(loaded)).toBe(1);
  });

  it('starts clean on a corrupt entry', () => {
    localStorage.setItem('dbview-pending-alpha', '{not json');
    expect(readPersisted('alpha')).toEqual({ db: 'alpha', byTable: {} });
  });
});
