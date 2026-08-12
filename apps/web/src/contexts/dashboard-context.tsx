
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnection } from './connection-context';
import { useToast } from './toast-context';
import { ColumnInfo } from '@/types';
import { type MutationRequest } from '@/lib/mutation';
import { type Filter } from '@/lib/filters';
import type { SavedQuery } from '@/types';
import { useSavedQueries } from '../hooks/use-saved-queries';
import { db } from '@/lib/db';
import { type TableStatsData } from '../components/table-stats';
import { type Tab } from '../components/tab-bar';
import { nextActiveAfterClose, reorderTabs as reorderTabList } from '@/lib/tabs';

/** Workspace data. Split from the actions so dispatch-only consumers don't
 * re-render when a row loads. */
interface DashboardState {
  openTabs: Tab[];
  activeTabId: string | undefined;
  tables: string[];
  schemas: string[];
  selectedSchema: string;
  selectedTable: string | undefined;
  tableData: any[];
  columns: string[];
  schema: ColumnInfo[];
  views: string[];
  materializedViews: string[];
  dbFunctions: any[];
  relationships: any[];
  indexes: any[];
  isLoadingTables: boolean;
  isLoading: boolean;
  /** Refetch over rows already on screen — sort, filter, page, reload. */
  isRefreshing: boolean;
  isLoadingSchema: boolean;
  currentPage: number;
  totalItems: number;
  countIsEstimate: boolean;
  /** Wall-clock time of the last row fetch, for the toolbar readout. */
  queryDurationMs: number | null;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  visibleColumns: string[];
  tableSearch: string;
  tableFilters: Filter[];
  error: string | null;
  itemsPerPage: number;
  primaryKeys: string[];
  tableStats: TableStatsData | null;
  isLoadingStats: boolean;
  schemaMap: Record<string, string[]>;
  tableRowCounts: Record<string, number>;
  queryTabResults: Record<string, { rows: any[]; columns: string[]; executionTime: number }>;
  isQueryTab: boolean;
  isEditorTab: boolean;
  savedQueries: SavedQuery[];
}

/** Stable for the provider's lifetime: actions read state from a ref rather
 * than closing over it, so this context's value never changes. */
interface DashboardActions {
  openTab: (name: string, type?: Tab['type']) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;
  toggleTabPin: (tabId: string) => void;
  setTableFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  addTableFilter: (filter: Filter) => void;
  removeTableFilter: (column: string) => void;
  clearTableFilters: () => void;
  setItemsPerPage: (size: number) => void;
  setSelectedSchema: (schema: string) => void;
  setSelectedTable: (table: string | undefined) => void;
  setCurrentPage: (page: number) => void;
  setSortColumn: (col: string | null) => void;
  setSortDirection: (dir: 'asc' | 'desc' | null) => void;
  setVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>;
  setTableSearch: (search: string) => void;
  loadTables: (schema?: string) => Promise<void>;
  loadTableData: (tableName: string, page: number) => Promise<void>;
  loadTableSchema: (tableName: string) => Promise<void>;
  loadRelationships: (tableName: string) => Promise<void>;
  handleSchemaChange: (schema: string) => void;
  handleTableSelect: (table: string) => void;
  handleSort: (column: string) => void;
  mutateRow: (request: MutationRequest) => Promise<void>;
  refreshTableData: () => Promise<void>;
  openQueryTab: (label: string, rows: any[], cols: string[], executionTime: number) => void;
  openEditorTab: (initialQuery?: string) => void;
  saveQuery: (name: string, query: string, tags: string[]) => void;
  updateSavedQuery: (id: string, updates: Partial<Pick<SavedQuery, 'name' | 'query' | 'tags'>>) => void;
  deleteSavedQuery: (id: string) => void;
}

type DashboardContextType = DashboardState & DashboardActions;

const DashboardStateContext = createContext<DashboardState | undefined>(undefined);
const DashboardActionsContext = createContext<DashboardActions | undefined>(undefined);

// Per-tab UI state (not data — TanStack caches the data)
interface TabUIState {
  currentPage: number;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  visibleColumns: string[];
  tableSearch: string;
  tableFilters: Filter[];
}

// `?? []` would hand consumers a fresh array every render, defeating the memo.
const EMPTY_STRINGS: string[] = [];
const EMPTY_ROWS: any[] = [];
const EMPTY_COLUMNS: ColumnInfo[] = [];
const EMPTY_SCHEMA_MAP: Record<string, string[]> = {};
const EMPTY_COUNTS: Record<string, number> = {};

const editorDraftKey = (tabId: string) => `dbview-editor-${tabId}`;

function discardEditorDraft(tabId: string) {
  if (!tabId.startsWith('editor:') || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(editorDraftKey(tabId));
  } catch {
    // ignore
  }
}

function omitKey<T>(obj: Record<string, T>, key: string): Record<string, T> {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, databaseType, databaseName } = useConnection();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const {
    savedQueries,
    saveQuery,
    updateQuery: updateSavedQuery,
    deleteQuery: deleteSavedQuery,
  } = useSavedQueries();

  // UI state
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilters, setTableFilters] = useState<Filter[]>([]);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | undefined>();
  const [queryTabResults, setQueryTabResults] = useState<Record<string, { rows: any[]; columns: string[]; executionTime: number }>>({});

  // Namespaces the query cache: two connections whose schemas share a name
  // (the common `public` case) would otherwise share cache entries.
  const dbKey = databaseName ?? '';

  // Written in a layout effect so it is current before any event can fire
  // against the committed UI.
  const latest = useRef({
    selectedSchema,
    selectedTable,
    activeTabId,
    openTabs,
    currentPage,
    sortColumn,
    sortDirection,
    visibleColumns,
    tableSearch,
    tableFilters,
    dbKey,
  });
  useLayoutEffect(() => {
    latest.current = {
      selectedSchema,
      selectedTable,
      activeTabId,
      openTabs,
      currentPage,
      sortColumn,
      sortDirection,
      visibleColumns,
      tableSearch,
      tableFilters,
      dbKey,
    };
  });

  // Per-tab UI state cache
  const tabUIStateRef = useRef<Record<string, TabUIState>>({});
  // Tracked explicitly so "hide all columns" sticks — an empty
  // `visibleColumns` used to double as "not seeded yet".
  const columnsSeededRef = useRef<Set<string>>(new Set());

  const saveCurrentTabUIState = useCallback(() => {
    const s = latest.current;
    if (!s.activeTabId) return;
    tabUIStateRef.current[s.activeTabId] = {
      currentPage: s.currentPage,
      sortColumn: s.sortColumn,
      sortDirection: s.sortDirection,
      visibleColumns: s.visibleColumns,
      tableSearch: s.tableSearch,
      tableFilters: s.tableFilters,
    };
  }, []);

  const restoreTabUIState = useCallback((tabId: string): boolean => {
    const cached = tabUIStateRef.current[tabId];
    if (!cached) return false;
    setCurrentPage(cached.currentPage);
    setSortColumn(cached.sortColumn);
    setSortDirection(cached.sortDirection);
    setVisibleColumns(cached.visibleColumns);
    setTableSearch(cached.tableSearch);
    setTableFilters(cached.tableFilters ?? []);
    columnsSeededRef.current.add(tabId);
    return true;
  }, []);

  const resetTabUIState = useCallback((tabId: string) => {
    setCurrentPage(1);
    setSortColumn(null);
    setSortDirection(null);
    setVisibleColumns([]);
    setTableSearch('');
    setTableFilters([]);
    columnsSeededRef.current.delete(tabId);
  }, []);

  const clearTabUIState = useCallback((tabId: string) => {
    delete tabUIStateRef.current[tabId];
    columnsSeededRef.current.delete(tabId);
  }, []);

  /** Point the workspace at `tab`, restoring its saved view if we have one. */
  const activateTab = useCallback(
    (tab: Tab | undefined) => {
      if (!tab) {
        setActiveTabId(undefined);
        setSelectedTable(undefined);
        return;
      }
      setActiveTabId(tab.id);
      if (tab.type === 'query' || tab.type === 'editor') {
        setSelectedTable(undefined);
        return;
      }
      setSelectedTable(tab.label);
      if (!restoreTabUIState(tab.id)) resetTabUIState(tab.id);
    },
    [restoreTabUIState, resetTabUIState]
  );

  /** Drop what a set of tabs owns: cached view state and editor drafts. */
  const discardTabs = useCallback(
    (tabs: Tab[]) => {
      for (const tab of tabs) {
        clearTabUIState(tab.id);
        discardEditorDraft(tab.id);
      }
    },
    [clearTabUIState]
  );

  // Tracks which database we've already restored tabs for, so we can gate
  // localStorage writes until the one-shot restore has completed.
  const tabsRestoredForRef = useRef<string | null>(null);
  // Track the (databaseName, databaseType) tuple we last initialized for.
  // Resetting on either change covers both "switched to a different DB"
  // and "the backend kind changed underneath us" (e.g. saved connection
  // round-trip lost the type and is now corrected).
  const schemaInitializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (isConnected && databaseName) {
      const key = `${databaseType}::${databaseName}`;
      if (schemaInitializedForRef.current !== key) {
        schemaInitializedForRef.current = key;
        const defaultSchema = databaseType === 'sqlite'
          ? 'main'
          : databaseType === 'mysql' && databaseName ? databaseName : 'public';
        setSelectedSchema(defaultSchema);
      }
    }
    if (!isConnected) {
      schemaInitializedForRef.current = null;
      tabsRestoredForRef.current = null;
      columnsSeededRef.current.clear();
      setSelectedTable(undefined);
      setOpenTabs([]);
      setActiveTabId(undefined);
      queryClient.clear();
    }
  }, [isConnected, databaseType, databaseName, queryClient]);

  // Restore persisted tabs once per database connection. Tabs are stored
  // per-database so switching DBs swaps the whole set; if the target DB has
  // no saved tabs we clear the bar instead of leaking the previous DB's
  // tabs (which point at tables that may not exist in the new schema).
  useEffect(() => {
    if (!isConnected || !databaseName) return;
    if (tabsRestoredForRef.current === databaseName) return;
    tabsRestoredForRef.current = databaseName;
    columnsSeededRef.current.clear();
    let restored = false;
    try {
      const raw = localStorage.getItem(`dbview-tabs-${databaseName}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { openTabs?: Tab[]; activeTabId?: string };
        if (Array.isArray(parsed.openTabs)) {
          setOpenTabs(parsed.openTabs);
          setActiveTabId(parsed.activeTabId);
          const active = parsed.openTabs.find((t) => t.id === parsed.activeTabId);
          setSelectedTable(active?.type === 'table' ? active.label : undefined);
          restored = true;
        }
      }
    } catch {
      // corrupt entry — fall through to the clean-slate path below
    }
    if (!restored) {
      setOpenTabs([]);
      setActiveTabId(undefined);
      setSelectedTable(undefined);
      tabUIStateRef.current = {};
    }
  }, [isConnected, databaseName]);

  // Persist tab bar whenever it changes (after restore has completed).
  useEffect(() => {
    if (!isConnected || !databaseName) return;
    if (tabsRestoredForRef.current !== databaseName) return;
    try {
      localStorage.setItem(
        `dbview-tabs-${databaseName}`,
        JSON.stringify({ openTabs, activeTabId })
      );
    } catch {
      // quota exceeded or storage disabled — best effort
    }
  }, [openTabs, activeTabId, isConnected, databaseName]);

  const schemasQuery = useQuery({
    queryKey: ['schemas', dbKey],
    queryFn: () => db.listSchemas(),
    enabled: isConnected,
  });

  const tablesQuery = useQuery({
    queryKey: ['tables', dbKey, selectedSchema],
    queryFn: () => db.listTables(selectedSchema),
    enabled: isConnected,
  });

  const viewsQuery = useQuery({
    queryKey: ['views', dbKey, selectedSchema],
    queryFn: () => db.listViews(selectedSchema),
    enabled: isConnected,
  });

  const functionsQuery = useQuery({
    queryKey: ['functions', dbKey, selectedSchema],
    queryFn: () => db.listFunctions(selectedSchema),
    enabled: isConnected,
  });

  const schemaMapQuery = useQuery({
    queryKey: ['schemaMap', dbKey, selectedSchema],
    queryFn: () => db.schemaMap(selectedSchema),
    enabled: isConnected,
  });

  const tableCountsQuery = useQuery({
    queryKey: ['tableCounts', dbKey, selectedSchema],
    queryFn: () => db.tableCounts(selectedSchema),
    enabled: isConnected,
    // Counts are estimates (Postgres reltuples / MySQL TABLE_ROWS) — keep
    // them cached aggressively to avoid hammering the catalog on every
    // sidebar mount.
    staleTime: 1000 * 60 * 5,
  });

  const tableDataQuery = useQuery({
    queryKey: ['tableData', dbKey, selectedTable, selectedSchema, currentPage, sortColumn, sortDirection, itemsPerPage, tableFilters],
    queryFn: async () => {
      const offset = (currentPage - 1) * itemsPerPage;
      const startedAt = performance.now();
      const data = await db.tableRows({
        table: selectedTable!,
        schema: selectedSchema,
        limit: itemsPerPage,
        offset,
        sortColumn: sortColumn ?? undefined,
        sortDirection: sortDirection ?? undefined,
        filters: tableFilters,
      });
      const rows = data.rows || [];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        rows,
        columns: cols,
        total: data.total || 0,
        countIsEstimate: data.countIsEstimate || false,
        durationMs: performance.now() - startedAt,
      };
    },
    enabled: isConnected && !!selectedTable,
    // Sort/filter/page re-query the same table: keep the rows on screen rather
    // than swapping in a skeleton. Switching tables still clears.
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey as unknown[] | undefined;
      if (!key) return undefined;
      const sameTable =
        key[1] === dbKey && key[2] === selectedTable && key[3] === selectedSchema;
      return sameTable ? previous : undefined;
    },
  });

  const tableSchemaQuery = useQuery({
    queryKey: ['tableSchema', dbKey, selectedTable, selectedSchema],
    queryFn: async () => {
      const cols = await db.tableSchema(selectedTable!, selectedSchema);
      return (cols as any[]).map((row: any) => ({
        name: row.column_name ?? row.name,
        type: row.data_type ?? row.type,
        nullable: row.is_nullable === 'YES' || row.nullable === true,
        default: row.column_default ?? row.default ?? null,
        isPrimaryKey: row.is_primary_key ?? row.isPrimaryKey ?? false,
      })) as ColumnInfo[];
    },
    enabled: isConnected && !!selectedTable,
  });

  const relationshipsQuery = useQuery({
    queryKey: ['relationships', dbKey, selectedTable, selectedSchema],
    queryFn: () => db.relationships(selectedTable!, selectedSchema),
    enabled: isConnected && !!selectedTable,
  });

  const tableStatsQuery = useQuery({
    queryKey: ['tableStats', dbKey, selectedTable, selectedSchema],
    queryFn: () => db.tableStats(selectedTable!, selectedSchema) as Promise<TableStatsData | null>,
    enabled: isConnected && !!selectedTable,
  });

  const tables = tablesQuery.data ?? EMPTY_STRINGS;
  const schemas = schemasQuery.data ?? EMPTY_STRINGS;
  const tableData = tableDataQuery.data?.rows ?? EMPTY_ROWS;
  // Prefer columns inferred from the first row (preserves the actual return
  // order from the DB). For empty tables there are no rows to infer from, so
  // fall back to the schema metadata — without this DataTable receives an
  // empty columns array and renders neither headers nor the empty-row
  // affordance, leaving a blank panel.
  const columns = useMemo(() => {
    const fromRows = tableDataQuery.data?.columns ?? [];
    if (fromRows.length > 0) return fromRows;
    return (tableSchemaQuery.data ?? []).map((c) => c.name);
  }, [tableDataQuery.data?.columns, tableSchemaQuery.data]);
  const totalItems = tableDataQuery.data?.total ?? 0;
  const queryDurationMs = tableDataQuery.data?.durationMs ?? null;
  const countIsEstimate = tableDataQuery.data?.countIsEstimate ?? false;
  const schema = useMemo(() => tableSchemaQuery.data ?? EMPTY_COLUMNS, [tableSchemaQuery.data]);
  const views = viewsQuery.data?.views ?? EMPTY_STRINGS;
  const materializedViews = viewsQuery.data?.materializedViews ?? EMPTY_STRINGS;
  const dbFunctions = functionsQuery.data ?? EMPTY_ROWS;
  const relationships = relationshipsQuery.data?.relationships ?? EMPTY_ROWS;
  const indexes = relationshipsQuery.data?.indexes ?? EMPTY_ROWS;
  const schemaMap = schemaMapQuery.data ?? EMPTY_SCHEMA_MAP;
  const tableRowCounts = tableCountsQuery.data ?? EMPTY_COUNTS;
  const tableStats = tableStatsQuery.data ?? null;

  const isLoadingTables = tablesQuery.isLoading;
  // Only "nothing to show yet" earns a skeleton; a refetch over existing rows
  // is `isRefreshing`, which the grid renders as a progress bar.
  const isLoading = tableDataQuery.isLoading;
  const isRefreshing = tableDataQuery.isFetching && !tableDataQuery.isLoading;
  const isLoadingSchema = tableSchemaQuery.isLoading;
  const isLoadingStats = tableStatsQuery.isLoading;

  const error = tableDataQuery.error?.message ?? tablesQuery.error?.message ?? null;

  // Gated on the tab, not on `visibleColumns` being empty, so hiding every
  // column is a state the user can stay in.
  useEffect(() => {
    if (columns.length === 0) return;
    const tab = activeTabId ?? '';
    if (columnsSeededRef.current.has(tab)) return;
    columnsSeededRef.current.add(tab);
    setVisibleColumns(columns);
  }, [columns, activeTabId]);

  const primaryKeys = useMemo(
    () => schema.filter((col) => col.isPrimaryKey).map((col) => col.name),
    [schema]
  );

  const addTableFilter = useCallback((filter: Filter) => {
    setTableFilters((prev) => {
      // Replace any existing filter on the same column — single filter per
      // column for v1 keeps the UI simple. Multi-condition is a follow-up.
      const without = prev.filter((f) => f.column !== filter.column);
      return [...without, filter];
    });
    setCurrentPage(1);
  }, []);

  const removeTableFilter = useCallback((column: string) => {
    setTableFilters((prev) => prev.filter((f) => f.column !== column));
    setCurrentPage(1);
  }, []);

  const clearTableFilters = useCallback(() => {
    setTableFilters([]);
    setCurrentPage(1);
  }, []);

  const loadTables = useCallback(async (schemaName?: string) => {
    const { selectedSchema, dbKey } = latest.current;
    if (schemaName && schemaName !== selectedSchema) {
      // Will be handled by query key change after setSelectedSchema
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['tables', dbKey, schemaName || selectedSchema] });
  }, [queryClient]);

  const loadTableData = useCallback(async (tableName: string, _page: number) => {
    await queryClient.invalidateQueries({ queryKey: ['tableData', latest.current.dbKey, tableName] });
  }, [queryClient]);

  const loadTableSchema = useCallback(async (tableName: string) => {
    await queryClient.invalidateQueries({ queryKey: ['tableSchema', latest.current.dbKey, tableName] });
  }, [queryClient]);

  const loadRelationshipsImperative = useCallback(async (tableName: string) => {
    await queryClient.invalidateQueries({ queryKey: ['relationships', latest.current.dbKey, tableName] });
  }, [queryClient]);

  const refreshTableData = useCallback(async () => {
    const { selectedTable, dbKey } = latest.current;
    if (!selectedTable) return;
    // Use refetchQueries (not invalidateQueries) so the network call fires
    // synchronously. invalidateQueries only marks the cache stale, which
    // races against component-mount observation — feels broken to users
    // who click the reload button on a table they're already viewing.
    await queryClient.refetchQueries({ queryKey: ['tableData', dbKey, selectedTable] });
  }, [queryClient]);

  const mutateRow = useCallback(async (request: MutationRequest) => {
    await db.mutate(request);
    addToast(`${request.type} successful`, 'success');
    await refreshTableData();
  }, [addToast, refreshTableData]);

  const openTab = useCallback((name: string, type: Tab['type'] = 'table') => {
    const tabId = `${type}:${name}`;
    const { activeTabId } = latest.current;
    if (tabId === activeTabId) return;
    saveCurrentTabUIState();
    setOpenTabs((prev) =>
      prev.some((t) => t.id === tabId) ? prev : [...prev, { id: tabId, label: name, type }]
    );
    setActiveTabId(tabId);
    setSelectedTable(name);
    if (!restoreTabUIState(tabId)) resetTabUIState(tabId);
  }, [saveCurrentTabUIState, restoreTabUIState, resetTabUIState]);

  const closeTab = useCallback((tabId: string) => {
    const { openTabs, activeTabId } = latest.current;
    clearTabUIState(tabId);
    discardEditorDraft(tabId);
    if (tabId.startsWith('query:')) {
      setQueryTabResults((prev) => omitKey(prev, tabId));
    }
    setOpenTabs(openTabs.filter((t) => t.id !== tabId));
    if (tabId !== activeTabId) return;
    activateTab(nextActiveAfterClose(openTabs, tabId));
  }, [clearTabUIState, activateTab]);

  const setActiveTab = useCallback((tabId: string) => {
    const { activeTabId, openTabs } = latest.current;
    if (tabId === activeTabId) return;
    const tab = openTabs.find((t) => t.id === tabId);
    if (!tab) return;
    saveCurrentTabUIState();
    activateTab(tab);
  }, [saveCurrentTabUIState, activateTab]);

  const editorCounterRef = useRef(0);
  const openEditorTab = useCallback((initialQuery?: string) => {
    editorCounterRef.current += 1;
    const tabId = `editor:${Date.now()}_${editorCounterRef.current}`;
    const label = `SQL Editor ${editorCounterRef.current}`;
    if (initialQuery && typeof window !== 'undefined') {
      // Seed the per-tab editor storage so QueryEditor reads it on mount.
      try {
        localStorage.setItem(editorDraftKey(tabId), initialQuery);
      } catch {
        // ignore
      }
    }
    saveCurrentTabUIState();
    setOpenTabs((prev) => [...prev, { id: tabId, label, type: 'editor' }]);
    setActiveTabId(tabId);
    setSelectedTable(undefined);
  }, [saveCurrentTabUIState]);

  const openQueryTab = useCallback((label: string, rows: any[], cols: string[], executionTime: number) => {
    const tabId = `query:${label}_${Date.now()}`;
    saveCurrentTabUIState();
    setOpenTabs((prev) => [...prev, { id: tabId, label, type: 'query' }]);
    setActiveTabId(tabId);
    setSelectedTable(undefined);
    setQueryTabResults((prev) => ({ ...prev, [tabId]: { rows, columns: cols, executionTime } }));
  }, [saveCurrentTabUIState]);

  const closeAllTabs = useCallback(() => {
    discardTabs(latest.current.openTabs);
    setOpenTabs([]);
    setActiveTabId(undefined);
    setSelectedTable(undefined);
    setQueryTabResults({});
  }, [discardTabs]);

  const closeOtherTabs = useCallback((tabId: string) => {
    const { openTabs, activeTabId } = latest.current;
    const kept = openTabs.find((t) => t.id === tabId);
    discardTabs(openTabs.filter((t) => t.id !== tabId));
    setOpenTabs(kept ? [kept] : []);
    setQueryTabResults((prev) => (tabId in prev ? { [tabId]: prev[tabId] } : {}));
    if (tabId === activeTabId) return;
    saveCurrentTabUIState();
    activateTab(kept);
  }, [discardTabs, saveCurrentTabUIState, activateTab]);

  const reorderTabs = useCallback((fromId: string, toId: string) => {
    setOpenTabs((prev) => reorderTabList(prev, fromId, toId));
  }, []);

  const toggleTabPin = useCallback((tabId: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t))
    );
  }, []);

  const handleSchemaChange = useCallback((newSchema: string) => {
    discardTabs(latest.current.openTabs);
    setSelectedSchema(newSchema);
    setSelectedTable(undefined);
    setOpenTabs([]);
    setActiveTabId(undefined);
    setQueryTabResults({});
  }, [discardTabs]);

  const handleTableSelect = useCallback((table: string) => {
    openTab(table, 'table');
  }, [openTab]);

  const handleSort = useCallback((column: string) => {
    const { sortColumn, sortDirection } = latest.current;
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }, []);

  const state = useMemo<DashboardState>(() => ({
    openTabs,
    activeTabId,
    tables,
    schemas,
    selectedSchema,
    selectedTable,
    tableData,
    columns,
    schema,
    views,
    materializedViews,
    dbFunctions,
    relationships,
    indexes,
    isLoadingTables,
    isLoading,
    isRefreshing,
    isLoadingSchema,
    currentPage,
    totalItems,
    countIsEstimate,
    queryDurationMs,
    sortColumn,
    sortDirection,
    visibleColumns,
    tableSearch,
    tableFilters,
    error,
    itemsPerPage,
    primaryKeys,
    tableStats,
    isLoadingStats,
    schemaMap,
    tableRowCounts,
    queryTabResults,
    isQueryTab: activeTabId?.startsWith('query:') ?? false,
    isEditorTab: activeTabId?.startsWith('editor:') ?? false,
    savedQueries,
  }), [
    openTabs, activeTabId, tables, schemas, selectedSchema, selectedTable, tableData,
    columns, schema, views, materializedViews, dbFunctions, relationships, indexes,
    isLoadingTables, isLoading, isRefreshing, isLoadingSchema, currentPage, totalItems, countIsEstimate, queryDurationMs,
    sortColumn, sortDirection, visibleColumns, tableSearch, tableFilters, error,
    itemsPerPage, primaryKeys, tableStats, isLoadingStats, schemaMap, tableRowCounts,
    queryTabResults, savedQueries,
  ]);

  const actions = useMemo<DashboardActions>(() => ({
    openTab,
    closeTab,
    setActiveTab,
    closeAllTabs,
    closeOtherTabs,
    reorderTabs,
    toggleTabPin,
    setTableFilters,
    addTableFilter,
    removeTableFilter,
    clearTableFilters,
    setItemsPerPage,
    setSelectedSchema,
    setSelectedTable,
    setCurrentPage,
    setSortColumn,
    setSortDirection,
    setVisibleColumns,
    setTableSearch,
    loadTables,
    loadTableData,
    loadTableSchema,
    loadRelationships: loadRelationshipsImperative,
    handleSchemaChange,
    handleTableSelect,
    handleSort,
    mutateRow,
    refreshTableData,
    openQueryTab,
    openEditorTab,
    saveQuery,
    updateSavedQuery,
    deleteSavedQuery,
  }), [
    openTab, closeTab, setActiveTab, closeAllTabs, closeOtherTabs, reorderTabs, toggleTabPin,
    addTableFilter, removeTableFilter, clearTableFilters, loadTables, loadTableData,
    loadTableSchema, loadRelationshipsImperative, handleSchemaChange, handleTableSelect,
    handleSort, mutateRow, refreshTableData, openQueryTab, openEditorTab,
    saveQuery, updateSavedQuery, deleteSavedQuery,
  ]);

  return (
    <DashboardActionsContext.Provider value={actions}>
      <DashboardStateContext.Provider value={state}>{children}</DashboardStateContext.Provider>
    </DashboardActionsContext.Provider>
  );
}

export function useDashboardState(): DashboardState {
  const context = useContext(DashboardStateContext);
  if (context === undefined) {
    throw new Error('useDashboardState must be used within a DashboardProvider');
  }
  return context;
}

/** Never changes identity, so a consumer of actions alone never re-renders. */
export function useDashboardActions(): DashboardActions {
  const context = useContext(DashboardActionsContext);
  if (context === undefined) {
    throw new Error('useDashboardActions must be used within a DashboardProvider');
  }
  return context;
}

export function useDashboard(): DashboardContextType {
  const state = useDashboardState();
  const actions = useDashboardActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
