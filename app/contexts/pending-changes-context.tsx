'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useConnection } from './connection-context';
import type { MutationRequest } from '@/lib/mutation';

// ─── Types ───────────────────────────────────────────────────────

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

interface State {
  byTable: Record<string, TablePending>; // key = `${schema}.${table}`
}

const EMPTY_TABLE: TablePending = { edits: {}, inserts: [], deletes: {} };

// ─── Identity helpers ────────────────────────────────────────────

function tableKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function rowKeyFromPks(pks: Record<string, any>): string {
  // Stable serialization: sort keys so {id:1,tenant:'a'} === {tenant:'a',id:1}
  const sorted = Object.keys(pks).sort();
  return JSON.stringify(sorted.map((k) => [k, pks[k]]));
}

let tempIdCounter = 0;
function nextTempId(): string {
  tempIdCounter += 1;
  return `new-${Date.now()}-${tempIdCounter}`;
}

// ─── Reducer ─────────────────────────────────────────────────────

type Action =
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

function withTable(state: State, schema: string, table: string, fn: (t: TablePending) => TablePending): State {
  const key = tableKey(schema, table);
  const current = state.byTable[key] ?? EMPTY_TABLE;
  const updated = fn(current);
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
  return { byTable: next };
}

function reducer(state: State, action: Action): State {
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

    case 'DISCARD_TABLE': {
      const key = tableKey(action.schema, action.table);
      if (!state.byTable[key]) return state;
      const next = { ...state.byTable };
      delete next[key];
      return { byTable: next };
    }

    case 'DISCARD_ALL':
      return { byTable: {} };

    case 'CLEAR_AFTER_SAVE': {
      const key = tableKey(action.schema, action.table);
      if (!state.byTable[key]) return state;
      const next = { ...state.byTable };
      delete next[key];
      return { byTable: next };
    }

    case 'HYDRATE':
      return action.state;

    default:
      return state;
  }
}

function omitKey<T>(obj: Record<string, T>, key: string): Record<string, T> {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}

function valuesEqual(a: any, b: any): boolean {
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

// ─── Undo / redo (snapshot-based) ────────────────────────────────

const HISTORY_LIMIT = 50;

interface HistoryStacks {
  past: State[];
  future: State[];
}

// ─── Context ─────────────────────────────────────────────────────

interface PendingChangesContextValue {
  getPending(schema: string, table: string): TablePending;
  getCount(schema: string, table: string): number;
  totalPendingCount: number;

  stageEdit(args: {
    schema: string;
    table: string;
    pks: Record<string, any>;
    column: string;
    original: any;
    next: any;
  }): void;
  stageInsert(args: { schema: string; table: string; values?: Record<string, any> }): string;
  updateInsert(args: {
    schema: string;
    table: string;
    tempId: string;
    column: string;
    value: any;
  }): void;
  stageDelete(args: {
    schema: string;
    table: string;
    pks: Record<string, any>;
    snapshot: Record<string, any>;
  }): void;

  unstageEdit(args: { schema: string; table: string; rowKey: string; column: string }): void;
  unstageInsert(args: { schema: string; table: string; tempId: string }): void;
  unstageDelete(args: { schema: string; table: string; rowKey: string }): void;
  discardTable(args: { schema: string; table: string }): void;
  discardAll(): void;

  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;

  buildMutationRequests(args: { schema: string; table: string }): MutationRequest[];
  clearAfterSave(args: { schema: string; table: string }): void;
}

const PendingChangesContext = createContext<PendingChangesContextValue | undefined>(undefined);

const INITIAL_STATE: State = { byTable: {} };

export function PendingChangesProvider({ children }: { children: React.ReactNode }) {
  const { databaseName, isConnected } = useConnection();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const historyRef = useRef<HistoryStacks>({ past: [], future: [] });
  const hydratedForRef = useRef<string | null>(null);

  // Wrap dispatch so user-facing actions push the prior state onto the undo
  // stack and clear redo. HYDRATE / CLEAR_AFTER_SAVE bypass history.
  const recordingDispatch = useCallback((action: Action) => {
    if (action.type !== 'HYDRATE' && action.type !== 'CLEAR_AFTER_SAVE') {
      historyRef.current = {
        past: [...historyRef.current.past.slice(-(HISTORY_LIMIT - 1)), state],
        future: [],
      };
    }
    dispatch(action);
  }, [state]);

  // ─── Persistence ─────────────────────────────────────────────

  // Hydrate once per database connection.
  useEffect(() => {
    if (!isConnected || !databaseName) return;
    if (hydratedForRef.current === databaseName) return;
    hydratedForRef.current = databaseName;
    try {
      const raw = localStorage.getItem(`dbview-pending-${databaseName}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as State;
      if (parsed && typeof parsed === 'object' && parsed.byTable) {
        dispatch({ type: 'HYDRATE', state: parsed });
      }
    } catch {
      // corrupt — ignore
    }
  }, [isConnected, databaseName]);

  // Reset on disconnect.
  useEffect(() => {
    if (!isConnected) {
      hydratedForRef.current = null;
      historyRef.current = { past: [], future: [] };
      dispatch({ type: 'HYDRATE', state: INITIAL_STATE });
    }
  }, [isConnected]);

  // Persist on change (after hydration completes).
  useEffect(() => {
    if (!isConnected || !databaseName) return;
    if (hydratedForRef.current !== databaseName) return;
    try {
      if (Object.keys(state.byTable).length === 0) {
        localStorage.removeItem(`dbview-pending-${databaseName}`);
      } else {
        localStorage.setItem(`dbview-pending-${databaseName}`, JSON.stringify(state));
      }
    } catch {
      // quota / disabled — best effort
    }
  }, [state, isConnected, databaseName]);

  // ─── Read helpers ────────────────────────────────────────────

  const getPending = useCallback(
    (schema: string, table: string): TablePending => {
      return state.byTable[tableKey(schema, table)] ?? EMPTY_TABLE;
    },
    [state]
  );

  const getCount = useCallback(
    (schema: string, table: string): number => {
      const t = state.byTable[tableKey(schema, table)];
      if (!t) return 0;
      const editCells = Object.values(t.edits).reduce(
        (sum, e) => sum + Object.keys(e.changes).length,
        0
      );
      return editCells + t.inserts.length + Object.keys(t.deletes).length;
    },
    [state]
  );

  const totalPendingCount = useMemo(() => {
    let total = 0;
    for (const t of Object.values(state.byTable)) {
      total += Object.values(t.edits).reduce(
        (sum, e) => sum + Object.keys(e.changes).length,
        0
      );
      total += t.inserts.length;
      total += Object.keys(t.deletes).length;
    }
    return total;
  }, [state]);

  // ─── Action wrappers ─────────────────────────────────────────

  const stageEdit: PendingChangesContextValue['stageEdit'] = useCallback(
    ({ schema, table, pks, column, original, next }) => {
      recordingDispatch({ type: 'STAGE_EDIT', schema, table, pks, column, original, next });
    },
    [recordingDispatch]
  );

  const stageInsert: PendingChangesContextValue['stageInsert'] = useCallback(
    ({ schema, table, values = {} }) => {
      const tempId = nextTempId();
      recordingDispatch({ type: 'STAGE_INSERT', schema, table, tempId, values });
      return tempId;
    },
    [recordingDispatch]
  );

  const updateInsert: PendingChangesContextValue['updateInsert'] = useCallback(
    ({ schema, table, tempId, column, value }) => {
      recordingDispatch({ type: 'UPDATE_INSERT', schema, table, tempId, column, value });
    },
    [recordingDispatch]
  );

  const stageDelete: PendingChangesContextValue['stageDelete'] = useCallback(
    ({ schema, table, pks, snapshot }) => {
      recordingDispatch({ type: 'STAGE_DELETE', schema, table, pks, snapshot });
    },
    [recordingDispatch]
  );

  const unstageEdit: PendingChangesContextValue['unstageEdit'] = useCallback(
    ({ schema, table, rowKey, column }) => {
      recordingDispatch({ type: 'UNSTAGE_EDIT', schema, table, rowKey, column });
    },
    [recordingDispatch]
  );

  const unstageInsert: PendingChangesContextValue['unstageInsert'] = useCallback(
    ({ schema, table, tempId }) => {
      recordingDispatch({ type: 'UNSTAGE_INSERT', schema, table, tempId });
    },
    [recordingDispatch]
  );

  const unstageDelete: PendingChangesContextValue['unstageDelete'] = useCallback(
    ({ schema, table, rowKey }) => {
      recordingDispatch({ type: 'UNSTAGE_DELETE', schema, table, rowKey });
    },
    [recordingDispatch]
  );

  const discardTable: PendingChangesContextValue['discardTable'] = useCallback(
    ({ schema, table }) => {
      recordingDispatch({ type: 'DISCARD_TABLE', schema, table });
    },
    [recordingDispatch]
  );

  const discardAll = useCallback(() => {
    recordingDispatch({ type: 'DISCARD_ALL' });
  }, [recordingDispatch]);

  const undo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    historyRef.current = { past: past.slice(0, -1), future: [...future, state] };
    dispatch({ type: 'HYDRATE', state: previous });
  }, [state]);

  const redo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    historyRef.current = { past: [...past, state], future: future.slice(0, -1) };
    dispatch({ type: 'HYDRATE', state: next });
  }, [state]);

  // canUndo/canRedo are derived from the ref, so re-render whenever state
  // changes (which is always coincident with a history mutation).
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  // ─── Save helpers ────────────────────────────────────────────

  const buildMutationRequests = useCallback(
    ({ schema, table }: { schema: string; table: string }): MutationRequest[] => {
      const t = state.byTable[tableKey(schema, table)];
      if (!t) return [];
      const requests: MutationRequest[] = [];
      // Order: deletes first (free up unique constraints), then updates,
      // then inserts. This is a heuristic that handles common cases well.
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
    },
    [state]
  );

  const clearAfterSave: PendingChangesContextValue['clearAfterSave'] = useCallback(
    ({ schema, table }) => {
      historyRef.current = { past: [], future: [] };
      dispatch({ type: 'CLEAR_AFTER_SAVE', schema, table });
    },
    []
  );

  const value: PendingChangesContextValue = {
    getPending,
    getCount,
    totalPendingCount,
    stageEdit,
    stageInsert,
    updateInsert,
    stageDelete,
    unstageEdit,
    unstageInsert,
    unstageDelete,
    discardTable,
    discardAll,
    undo,
    redo,
    canUndo,
    canRedo,
    buildMutationRequests,
    clearAfterSave,
  };

  return (
    <PendingChangesContext.Provider value={value}>{children}</PendingChangesContext.Provider>
  );
}

export function usePendingChanges() {
  const ctx = useContext(PendingChangesContext);
  if (!ctx) {
    throw new Error('usePendingChanges must be used within a PendingChangesProvider');
  }
  return ctx;
}
