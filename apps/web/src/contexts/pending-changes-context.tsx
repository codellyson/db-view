
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
import {
  buildMutationRequests as buildRequests,
  countPending,
  countTablePending,
  historyReducer,
  nextTempId,
  readPersisted,
  tableKey,
  writePersisted,
  EMPTY_TABLE,
  INITIAL_HISTORY,
  INITIAL_STATE,
} from '@/lib/pending-changes-state';

export {
  rowKeyFromPks,
  type PendingDelete,
  type PendingEdit,
  type PendingInsert,
  type TablePending,
} from '@/lib/pending-changes-state';
import type { TablePending } from '@/lib/pending-changes-state';

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

export function PendingChangesProvider({ children }: { children: React.ReactNode }) {
  const { databaseName, isConnected } = useConnection();
  const [history, dispatch] = useReducer(historyReducer, INITIAL_HISTORY);
  const state = history.present;
  const hydratedForRef = useRef<string | null>(null);

  // Hydrate once per database. A miss still hydrates — with an empty slate
  // stamped for this database — so the previous connection's staged rows
  // can't survive the switch and get filed under the new database's key.
  useEffect(() => {
    if (!isConnected || !databaseName) return;
    if (hydratedForRef.current === databaseName) return;
    hydratedForRef.current = databaseName;
    dispatch({ type: 'HYDRATE', state: readPersisted(databaseName) });
  }, [isConnected, databaseName]);

  useEffect(() => {
    if (!isConnected) {
      hydratedForRef.current = null;
      dispatch({ type: 'HYDRATE', state: INITIAL_STATE });
    }
  }, [isConnected]);

  // Persist on change. Gated on the state's own `db` stamp rather than on
  // effect ordering, so a state still belonging to the previous database is
  // never written under the current one's key.
  useEffect(() => {
    if (!isConnected || !databaseName) return;
    if (state.db !== databaseName) return;
    writePersisted(state);
  }, [state, isConnected, databaseName]);

  const getPending = useCallback(
    (schema: string, table: string): TablePending =>
      state.byTable[tableKey(schema, table)] ?? EMPTY_TABLE,
    [state]
  );

  const getCount = useCallback(
    (schema: string, table: string): number =>
      countTablePending(state.byTable[tableKey(schema, table)]),
    [state]
  );

  const totalPendingCount = useMemo(() => countPending(state), [state]);

  const stageEdit: PendingChangesContextValue['stageEdit'] = useCallback(
    ({ schema, table, pks, column, original, next }) => {
      dispatch({ type: 'STAGE_EDIT', schema, table, pks, column, original, next });
    },
    []
  );

  const stageInsert: PendingChangesContextValue['stageInsert'] = useCallback(
    ({ schema, table, values = {} }) => {
      const tempId = nextTempId();
      dispatch({ type: 'STAGE_INSERT', schema, table, tempId, values });
      return tempId;
    },
    []
  );

  const updateInsert: PendingChangesContextValue['updateInsert'] = useCallback(
    ({ schema, table, tempId, column, value }) => {
      dispatch({ type: 'UPDATE_INSERT', schema, table, tempId, column, value });
    },
    []
  );

  const stageDelete: PendingChangesContextValue['stageDelete'] = useCallback(
    ({ schema, table, pks, snapshot }) => {
      dispatch({ type: 'STAGE_DELETE', schema, table, pks, snapshot });
    },
    []
  );

  const unstageEdit: PendingChangesContextValue['unstageEdit'] = useCallback(
    ({ schema, table, rowKey, column }) => {
      dispatch({ type: 'UNSTAGE_EDIT', schema, table, rowKey, column });
    },
    []
  );

  const unstageInsert: PendingChangesContextValue['unstageInsert'] = useCallback(
    ({ schema, table, tempId }) => {
      dispatch({ type: 'UNSTAGE_INSERT', schema, table, tempId });
    },
    []
  );

  const unstageDelete: PendingChangesContextValue['unstageDelete'] = useCallback(
    ({ schema, table, rowKey }) => {
      dispatch({ type: 'UNSTAGE_DELETE', schema, table, rowKey });
    },
    []
  );

  const discardTable: PendingChangesContextValue['discardTable'] = useCallback(
    ({ schema, table }) => {
      dispatch({ type: 'DISCARD_TABLE', schema, table });
    },
    []
  );

  const discardAll = useCallback(() => {
    dispatch({ type: 'DISCARD_ALL' });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const buildMutationRequests = useCallback(
    ({ schema, table }: { schema: string; table: string }): MutationRequest[] =>
      buildRequests(state, schema, table),
    [state]
  );

  const clearAfterSave: PendingChangesContextValue['clearAfterSave'] = useCallback(
    ({ schema, table }) => {
      dispatch({ type: 'CLEAR_AFTER_SAVE', schema, table });
    },
    []
  );

  const value = useMemo<PendingChangesContextValue>(
    () => ({
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
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      buildMutationRequests,
      clearAfterSave,
    }),
    [
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
      history.past.length,
      history.future.length,
      buildMutationRequests,
      clearAfterSave,
    ]
  );

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
