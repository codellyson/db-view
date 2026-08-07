import type { MutationRequest } from './mutation';

export interface PendingEdit {
  rowKey: string;
  pks: Record<string, any>;
  // Multi-cell edits on the same row collapse here. `original` is captured at
  // first edit so undo / discard restores the actual DB value, not the value
  // held by an intermediate edit.
  changes: Record<string, { original: any; next: any }>;
}

export interface PendingInsert {
  tempId: string;
  values: Record<string, any>;
}

export interface PendingDelete {
  rowKey: string;
  pks: Record<string, any>;
  snapshot: Record<string, any>;
}

export interface TablePending {
  edits: Record<string, PendingEdit>;
  inserts: PendingInsert[];
  deletes: Record<string, PendingDelete>;
}

/**
 * `db` stamps which database the staged rows belong to. Without it, switching
 * connections left the previous database's staged writes in play and the
 * persist effect filed them under the new database's key — one "Review & Run"
 * away from applying rows to the wrong database.
 */
export interface State {
  db: string | null;
  byTable: Record<string, TablePending>;
}

export const EMPTY_TABLE: TablePending = { edits: {}, inserts: [], deletes: {} };

export const INITIAL_STATE: State = { db: null, byTable: {} };

export function tableKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function rowKeyFromPks(pks: Record<string, any>): string {
  // Stable serialization: sort keys so {id:1,tenant:'a'} === {tenant:'a',id:1}
  const sorted = Object.keys(pks).sort();
  return JSON.stringify(sorted.map((k) => [k, pks[k]]));
}

let tempIdCounter = 0;
export function nextTempId(): string {
  tempIdCounter += 1;
  return `new-${Date.now()}-${tempIdCounter}`;
}

export type Action =
  | {
      type: 'STAGE_EDIT';
      schema: string;
      table: string;
      pks: Record<string, any>;
      column: string;
      original: any;
      next: any;
    }
  | {
      type: 'STAGE_INSERT';
      schema: string;
      table: string;
      tempId: string;
      values: Record<string, any>;
    }
  | {
      type: 'UPDATE_INSERT';
      schema: string;
      table: string;
      tempId: string;
      column: string;
      value: any;
    }
  | {
      type: 'STAGE_DELETE';
      schema: string;
      table: string;
      pks: Record<string, any>;
      snapshot: Record<string, any>;
    }
  | { type: 'UNSTAGE_EDIT'; schema: string; table: string; rowKey: string; column: string }
  | { type: 'UNSTAGE_INSERT'; schema: string; table: string; tempId: string }
  | { type: 'UNSTAGE_DELETE'; schema: string; table: string; rowKey: string }
  | { type: 'DISCARD_TABLE'; schema: string; table: string }
  | { type: 'DISCARD_ALL' }
  | { type: 'HYDRATE'; state: State }
  | { type: 'CLEAR_AFTER_SAVE'; schema: string; table: string };

export type HistoryAction = Action | { type: 'UNDO' } | { type: 'REDO' };

function withTable(
  state: State,
  schema: string,
  table: string,
  fn: (t: TablePending) => TablePending
): State {
  const key = tableKey(schema, table);
  const current = state.byTable[key] ?? EMPTY_TABLE;
  const updated = fn(current);
  if (updated === current) return state;
  const isEmpty =
    Object.keys(updated.edits).length === 0 &&
    updated.inserts.length === 0 &&
    Object.keys(updated.deletes).length === 0;
  const next = { ...state.byTable };
  if (isEmpty) {
    delete next[key];
  } else {
    next[key] = updated;
  }
  return { ...state, byTable: next };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'STAGE_EDIT': {
      const rowKey = rowKeyFromPks(action.pks);
      return withTable(state, action.schema, action.table, (t) => {
        const existing = t.edits[rowKey];
        const prevForCol = existing?.changes[action.column];
        // Reverting a staged cell back to its original value: drop the change.
        if (action.next === action.original || valuesEqual(action.next, action.original)) {
          if (!existing) return t;
          const nextChanges = { ...existing.changes };
          delete nextChanges[action.column];
          if (Object.keys(nextChanges).length === 0) {
            const nextEdits = { ...t.edits };
            delete nextEdits[rowKey];
            return { ...t, edits: nextEdits };
          }
          return { ...t, edits: { ...t.edits, [rowKey]: { ...existing, changes: nextChanges } } };
        }
        const change = {
          // Keep the very first original we saw for this cell — that's the
          // true DB value before any edits.
          original: prevForCol ? prevForCol.original : action.original,
          next: action.next,
        };
        const updated: PendingEdit = existing
          ? { ...existing, changes: { ...existing.changes, [action.column]: change } }
          : { rowKey, pks: action.pks, changes: { [action.column]: change } };
        return { ...t, edits: { ...t.edits, [rowKey]: updated } };
      });
    }

    case 'STAGE_INSERT': {
      return withTable(state, action.schema, action.table, (t) => ({
        ...t,
        inserts: [...t.inserts, { tempId: action.tempId, values: action.values }],
      }));
    }

    case 'UPDATE_INSERT': {
      return withTable(state, action.schema, action.table, (t) => ({
        ...t,
        inserts: t.inserts.map((ins) =>
          ins.tempId === action.tempId
            ? { ...ins, values: { ...ins.values, [action.column]: action.value } }
            : ins
        ),
      }));
    }

    case 'STAGE_DELETE': {
      const rowKey = rowKeyFromPks(action.pks);
      return withTable(state, action.schema, action.table, (t) => ({
        ...t,
        // Staging a delete supersedes any prior edit on the same row.
        edits: omitKey(t.edits, rowKey),
        deletes: { ...t.deletes, [rowKey]: { rowKey, pks: action.pks, snapshot: action.snapshot } },
      }));
    }

    case 'UNSTAGE_EDIT': {
      return withTable(state, action.schema, action.table, (t) => {
        const existing = t.edits[action.rowKey];
        if (!existing) return t;
        const nextChanges = { ...existing.changes };
        delete nextChanges[action.column];
        if (Object.keys(nextChanges).length === 0) {
          return { ...t, edits: omitKey(t.edits, action.rowKey) };
        }
        return { ...t, edits: { ...t.edits, [action.rowKey]: { ...existing, changes: nextChanges } } };
      });
    }

    case 'UNSTAGE_INSERT': {
      return withTable(state, action.schema, action.table, (t) => ({
        ...t,
        inserts: t.inserts.filter((ins) => ins.tempId !== action.tempId),
      }));
    }

    case 'UNSTAGE_DELETE': {
      return withTable(state, action.schema, action.table, (t) => ({
        ...t,
        deletes: omitKey(t.deletes, action.rowKey),
      }));
    }

    case 'DISCARD_TABLE':
    case 'CLEAR_AFTER_SAVE': {
      const key = tableKey(action.schema, action.table);
      if (!state.byTable[key]) return state;
      const next = { ...state.byTable };
      delete next[key];
      return { ...state, byTable: next };
    }

    case 'DISCARD_ALL':
      return Object.keys(state.byTable).length === 0 ? state : { ...state, byTable: {} };

    case 'HYDRATE':
      return action.state;

    default:
      return state;
  }
}

export interface HistoryState {
  present: State;
  past: State[];
  future: State[];
}

export const HISTORY_LIMIT = 50;

export const INITIAL_HISTORY: HistoryState = { present: INITIAL_STATE, past: [], future: [] };

/**
 * Undo/redo lives in the reducer rather than a ref so each recorded step is
 * the state the action actually applied to. When history was captured from a
 * closure, several dispatches in one tick (staging a bulk delete row by row)
 * all recorded the same pre-batch state: the first undo reverted the whole
 * batch and the rest were silent no-ops that also corrupted redo.
 */
export function historyReducer(h: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'UNDO': {
      if (h.past.length === 0) return h;
      return {
        present: h.past[h.past.length - 1],
        past: h.past.slice(0, -1),
        future: [...h.future, h.present],
      };
    }
    case 'REDO': {
      if (h.future.length === 0) return h;
      return {
        present: h.future[h.future.length - 1],
        past: [...h.past, h.present],
        future: h.future.slice(0, -1),
      };
    }
    default: {
      const present = reducer(h.present, action);
      // Hydrating a different database and committing a table both start a
      // new timeline — undoing across either would re-stage rows the user has
      // already saved, or rows belonging to a database they've left.
      if (action.type === 'HYDRATE' || action.type === 'CLEAR_AFTER_SAVE') {
        if (present === h.present && h.past.length === 0 && h.future.length === 0) return h;
        return { present, past: [], future: [] };
      }
      if (present === h.present) return h;
      return {
        present,
        past: [...h.past.slice(-(HISTORY_LIMIT - 1)), h.present],
        future: [],
      };
    }
  }
}

export function omitKey<T>(obj: Record<string, T>, key: string): Record<string, T> {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}

export function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return String(a) === String(b);
}

export function countTablePending(t: TablePending | undefined): number {
  if (!t) return 0;
  const editCells = Object.values(t.edits).reduce(
    (sum, e) => sum + Object.keys(e.changes).length,
    0
  );
  return editCells + t.inserts.length + Object.keys(t.deletes).length;
}

export function countPending(state: State): number {
  return Object.values(state.byTable).reduce((sum, t) => sum + countTablePending(t), 0);
}

export function buildMutationRequests(
  state: State,
  schema: string,
  table: string
): MutationRequest[] {
  const t = state.byTable[tableKey(schema, table)];
  if (!t) return [];
  const requests: MutationRequest[] = [];
  // Order: deletes first (free up unique constraints), then updates, then
  // inserts. This is a heuristic that handles common cases well.
  for (const del of Object.values(t.deletes)) {
    requests.push({ type: 'DELETE', schema, table, where: del.pks });
  }
  for (const edit of Object.values(t.edits)) {
    const values: Record<string, any> = {};
    for (const [col, change] of Object.entries(edit.changes)) {
      values[col] = change.next;
    }
    requests.push({ type: 'UPDATE', schema, table, values, where: edit.pks });
  }
  for (const ins of t.inserts) {
    requests.push({ type: 'INSERT', schema, table, values: ins.values });
  }
  return requests;
}

const storageKey = (db: string) => `dbview-pending-${db}`;

/**
 * Read the staged rows belonging to `db`. Always returns state stamped with
 * that database, so a miss produces an empty slate rather than leaving the
 * previous database's rows in place.
 */
export function readPersisted(db: string): State {
  try {
    const raw = localStorage.getItem(storageKey(db));
    if (!raw) return { db, byTable: {} };
    const parsed = JSON.parse(raw) as Partial<State>;
    if (parsed && typeof parsed === 'object' && parsed.byTable) {
      return { db, byTable: parsed.byTable };
    }
  } catch {
    // corrupt entry — start clean
  }
  return { db, byTable: {} };
}

export function writePersisted(state: State): void {
  if (!state.db) return;
  try {
    if (Object.keys(state.byTable).length === 0) {
      localStorage.removeItem(storageKey(state.db));
    } else {
      localStorage.setItem(storageKey(state.db), JSON.stringify({ byTable: state.byTable }));
    }
  } catch {
    // quota / disabled — best effort
  }
}
