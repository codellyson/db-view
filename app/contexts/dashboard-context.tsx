'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnection } from './connection-context';
import { useToast } from './toast-context';
import { ColumnInfo } from '@/types';
import { type MutationRequest } from '@/lib/mutation';
import { api } from '@/lib/api';
import { type TableStatsData } from '../components/table-stats';
import { type Tab } from '../components/tab-bar';

interface DashboardContextType {
  openTabs: Tab[];
  activeTabId: string | undefined;
  openTab: (name: string, type?: Tab['type']) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
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
  isLoadingSchema: boolean;
  currentPage: number;
  totalItems: number;
  countIsEstimate: boolean;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  visibleColumns: string[];
  tableSearch: string;
  error: string | null;
  itemsPerPage: number;
  setItemsPerPage: (size: number) => void;
  readOnlyMode: boolean;
  primaryKeys: string[];
  tableStats: TableStatsData | null;
  isLoadingStats: boolean;
  schemaMap: Record<string, string[]>;
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
  queryTabResults: Record<string, { rows: any[]; columns: string[]; executionTime: number }>;
  isQueryTab: boolean;
  openEditorTab: () => void;
  isEditorTab: boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Per-tab UI state (not data — TanStack caches the data)
interface TabUIState {
  currentPage: number;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  visibleColumns: string[];
  tableSearch: string;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, databaseType, databaseName } = useConnection();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // UI state
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | undefined>();
  const [queryTabResults, setQueryTabResults] = useState<Record<string, { rows: any[]; columns: string[]; executionTime: number }>>({});

  // Per-tab UI state cache
  const tabUIStateRef = useRef<Record<string, TabUIState>>({});

  const saveCurrentTabUIState = useCallback(() => {
    if (!activeTabId) return;
    tabUIStateRef.current[activeTabId] = {
      currentPage,
      sortColumn,
      sortDirection,
      visibleColumns,
      tableSearch,
    };
  }, [activeTabId, currentPage, sortColumn, sortDirection, visibleColumns, tableSearch]);

  const restoreTabUIState = useCallback((tabId: string): boolean => {
    const cached = tabUIStateRef.current[tabId];
    if (!cached) return false;
    setCurrentPage(cached.currentPage);
    setSortColumn(cached.sortColumn);
    setSortDirection(cached.sortDirection);
    setVisibleColumns(cached.visibleColumns);
    setTableSearch(cached.tableSearch);
    return true;
  }, []);

  const clearTabUIState = useCallback((tabId: string) => {
    delete tabUIStateRef.current[tabId];
  }, []);

  // Set default schema on connection
  const hasLoadedRef = useRef(false);
  // Tracks which database we've already restored tabs for, so we can gate
  // localStorage writes until the one-shot restore has completed.
  const tabsRestoredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (isConnected && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      const defaultSchema = databaseType === 'sqlite'
        ? 'main'
        : databaseType === 'mysql' && databaseName ? databaseName : 'public';
      setSelectedSchema(defaultSchema);
    }
    if (!isConnected) {
      hasLoadedRef.current = false;
      tabsRestoredForRef.current = null;
      setSelectedTable(undefined);
      setOpenTabs([]);
      setActiveTabId(undefined);
      queryClient.clear();
    }
  }, [isConnected, databaseType, databaseName, queryClient]);

  // Restore persisted tabs once per database connection.
  useEffect(() => {
    if (!isConnected || !databaseName) return;
    if (tabsRestoredForRef.current === databaseName) return;
    tabsRestoredForRef.current = databaseName;
    try {
      const raw = localStorage.getItem(`dbview-tabs-${databaseName}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { openTabs?: Tab[]; activeTabId?: string };
      if (!Array.isArray(parsed.openTabs)) return;
      setOpenTabs(parsed.openTabs);
      setActiveTabId(parsed.activeTabId);
      const active = parsed.openTabs.find((t) => t.id === parsed.activeTabId);
      if (active && active.type === 'table') {
        setSelectedTable(active.label);
      }
    } catch {
      // corrupt entry — ignore
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

  // ─── TanStack Queries ───────────────────────────────────────

  const schemasQuery = useQuery({
    queryKey: ['schemas'],
    queryFn: async () => {
      const data = await api.get('/api/schemas');
      return (data.schemas || []) as string[];
    },
    enabled: isConnected,
  });

  const tablesQuery = useQuery({
    queryKey: ['tables', selectedSchema],
    queryFn: async () => {
      const data = await api.get(`/api/tables?schema=${encodeURIComponent(selectedSchema)}`);
      return (data.tables || []) as string[];
    },
    enabled: isConnected,
  });

  const viewsQuery = useQuery({
    queryKey: ['views', selectedSchema],
    queryFn: async () => {
      const data = await api.get(`/api/views?schema=${encodeURIComponent(selectedSchema)}`);
      return {
        views: (data.views || []) as string[],
        materializedViews: (data.materializedViews || []) as string[],
      };
    },
    enabled: isConnected,
  });

  const functionsQuery = useQuery({
    queryKey: ['functions', selectedSchema],
    queryFn: async () => {
      const data = await api.get(`/api/functions?schema=${encodeURIComponent(selectedSchema)}`);
      return (data.functions || []) as any[];
    },
    enabled: isConnected,
  });

  const schemaMapQuery = useQuery({
    queryKey: ['schemaMap', selectedSchema],
    queryFn: async () => {
      const data = await api.get(`/api/schema-map?schema=${encodeURIComponent(selectedSchema)}`);
      return (data.schemaMap || {}) as Record<string, string[]>;
    },
    enabled: isConnected,
  });

  const tableDataQuery = useQuery({
    queryKey: ['tableData', selectedTable, selectedSchema, currentPage, sortColumn, sortDirection, itemsPerPage],
    queryFn: async () => {
      const offset = (currentPage - 1) * itemsPerPage;
      let url = `/api/table/${encodeURIComponent(selectedTable!)}?limit=${itemsPerPage}&offset=${offset}&schema=${encodeURIComponent(selectedSchema)}`;
      if (sortColumn && sortDirection) {
        url += `&sortColumn=${encodeURIComponent(sortColumn)}&sortDirection=${sortDirection}`;
      }
      const data = await api.get(url);
      const rows = data.rows || [];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        rows,
        columns: cols,
        total: data.total || 0,
        countIsEstimate: data.countIsEstimate || false,
      };
    },
    enabled: isConnected && !!selectedTable,
  });

  const tableSchemaQuery = useQuery({
    queryKey: ['tableSchema', selectedTable, selectedSchema],
    queryFn: async () => {
      const data = await api.get(
        `/api/schema/${encodeURIComponent(selectedTable!)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      return ((data.schema || []) as any[]).map((row: any) => ({
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
    queryKey: ['relationships', selectedTable, selectedSchema],
    queryFn: async () => {
      const data = await api.get(
        `/api/relationships/${encodeURIComponent(selectedTable!)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      return {
        relationships: data.relationships || [],
        indexes: data.indexes || [],
      };
    },
    enabled: isConnected && !!selectedTable,
  });

  const tableStatsQuery = useQuery({
    queryKey: ['tableStats', selectedTable, selectedSchema],
    queryFn: async () => {
      const data = await api.get(
        `/api/table-stats/${encodeURIComponent(selectedTable!)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      return (data.stats || null) as TableStatsData | null;
    },
    enabled: isConnected && !!selectedTable,
  });

  // ─── Derived values from queries ────────────────────────────

  const tables = tablesQuery.data ?? [];
  const schemas = schemasQuery.data ?? [];
  const tableData = tableDataQuery.data?.rows ?? [];
  const columns = useMemo(() => tableDataQuery.data?.columns ?? [], [tableDataQuery.data?.columns]);
  const totalItems = tableDataQuery.data?.total ?? 0;
  const countIsEstimate = tableDataQuery.data?.countIsEstimate ?? false;
  const schema = useMemo(() => tableSchemaQuery.data ?? [], [tableSchemaQuery.data]);
  const views = viewsQuery.data?.views ?? [];
  const materializedViews = viewsQuery.data?.materializedViews ?? [];
  const dbFunctions = functionsQuery.data ?? [];
  const relationships = relationshipsQuery.data?.relationships ?? [];
  const indexes = relationshipsQuery.data?.indexes ?? [];
  const schemaMap = schemaMapQuery.data ?? {};
  const tableStats = tableStatsQuery.data ?? null;

  const isLoadingTables = tablesQuery.isLoading;
  const isLoading = tableDataQuery.isLoading;
  const isLoadingSchema = tableSchemaQuery.isLoading;
  const isLoadingStats = tableStatsQuery.isLoading;

  const error = tableDataQuery.error?.message ?? tablesQuery.error?.message ?? null;

  // Set visibleColumns when table data loads
  useEffect(() => {
    if (columns.length > 0 && visibleColumns.length === 0) {
      setVisibleColumns(columns);
    }
  }, [columns, visibleColumns.length]);

  const primaryKeys = useMemo(() => {
    return schema.filter((col) => col.isPrimaryKey).map((col) => col.name);
  }, [schema]);

  // ─── Imperative helpers (for backward compat) ───────────────

  const loadTables = useCallback(async (schemaName?: string) => {
    if (schemaName && schemaName !== selectedSchema) {
      // Will be handled by query key change after setSelectedSchema
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['tables', schemaName || selectedSchema] });
  }, [queryClient, selectedSchema]);

  const loadTableData = useCallback(async (tableName: string, _page: number) => {
    await queryClient.invalidateQueries({ queryKey: ['tableData', tableName] });
  }, [queryClient]);

  const loadTableSchema = useCallback(async (tableName: string) => {
    await queryClient.invalidateQueries({ queryKey: ['tableSchema', tableName] });
  }, [queryClient]);

  const loadRelationshipsImperative = useCallback(async (tableName: string) => {
    await queryClient.invalidateQueries({ queryKey: ['relationships', tableName] });
  }, [queryClient]);

  const refreshTableData = useCallback(async () => {
    if (selectedTable) {
      await queryClient.invalidateQueries({ queryKey: ['tableData', selectedTable] });
    }
  }, [selectedTable, queryClient]);

  const mutateRow = useCallback(async (request: MutationRequest) => {
    try {
      await api.post('/api/mutate', request, { noRetry: true });
      addToast(`${request.type} successful`, 'success');
      await refreshTableData();
    } catch (err: any) {
      if (err.status === 403) {
        setReadOnlyMode(true);
      }
      throw err;
    }
  }, [addToast, refreshTableData]);

  // ─── Tab management ─────────────────────────────────────────

  const openTab = useCallback((name: string, type: Tab['type'] = 'table') => {
    const tabId = `${type}:${name}`;
    if (tabId === activeTabId) return;
    saveCurrentTabUIState();
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      return [...prev, { id: tabId, label: name, type }];
    });
    setActiveTabId(tabId);
    setSelectedTable(name);
    if (!restoreTabUIState(tabId)) {
      setCurrentPage(1);
      setSortColumn(null);
      setSortDirection(null);
      setVisibleColumns([]);
      setTableSearch('');
    }
  }, [activeTabId, saveCurrentTabUIState, restoreTabUIState]);

  const closeTab = useCallback((tabId: string) => {
    clearTabUIState(tabId);
    if (tabId.startsWith('query:')) {
      setQueryTabResults((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    }
    if (tabId.startsWith('editor:') && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`dbview-editor-${tabId}`);
      } catch {
        // ignore
      }
    }
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        const newActive = next[Math.min(closedIndex, next.length - 1)];
        if (newActive) {
          setActiveTabId(newActive.id);
          if (newActive.type === 'query' || newActive.type === 'editor') {
            setSelectedTable(undefined);
          } else {
            setSelectedTable(newActive.label);
            if (!restoreTabUIState(newActive.id)) {
              setCurrentPage(1);
              setSortColumn(null);
              setSortDirection(null);
              setVisibleColumns([]);
              setTableSearch('');
            }
          }
        } else {
          setActiveTabId(undefined);
          setSelectedTable(undefined);
        }
      }
      return next;
    });
  }, [activeTabId, clearTabUIState, restoreTabUIState]);

  const setActiveTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    saveCurrentTabUIState();
    setActiveTabId(tabId);
    setOpenTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (tab) {
        if (tab.type === 'query' || tab.type === 'editor') {
          setSelectedTable(undefined);
        } else {
          setSelectedTable(tab.label);
          if (!restoreTabUIState(tabId)) {
            setCurrentPage(1);
            setSortColumn(null);
            setSortDirection(null);
            setVisibleColumns([]);
            setTableSearch('');
          }
        }
      }
      return prev;
    });
  }, [activeTabId, saveCurrentTabUIState, restoreTabUIState]);

  const editorCounterRef = useRef(0);
  const openEditorTab = useCallback(() => {
    editorCounterRef.current += 1;
    const tabId = `editor:${Date.now()}_${editorCounterRef.current}`;
    const label = `SQL Editor ${editorCounterRef.current}`;
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
    setOpenTabs([]);
    setActiveTabId(undefined);
    setSelectedTable(undefined);
    setQueryTabResults({});
  }, []);

  const closeOtherTabs = useCallback((tabId: string) => {
    setOpenTabs((prev) => prev.filter((t) => t.id === tabId));
    setActiveTabId(tabId);
  }, []);

  const handleSchemaChange = useCallback((newSchema: string) => {
    setSelectedSchema(newSchema);
    setSelectedTable(undefined);
    setOpenTabs([]);
    setActiveTabId(undefined);
  }, []);

  const handleTableSelect = useCallback((table: string) => {
    openTab(table, 'table');
  }, [openTab]);

  const handleSort = useCallback((column: string) => {
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
  }, [sortColumn, sortDirection]);

  // Reset page on sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortColumn, sortDirection]);

  return (
    <DashboardContext.Provider
      value={{
        openTabs,
        activeTabId,
        openTab,
        closeTab,
        setActiveTab,
        closeAllTabs,
        closeOtherTabs,
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
        isLoadingSchema,
        currentPage,
        totalItems,
        countIsEstimate,
        sortColumn,
        sortDirection,
        visibleColumns,
        tableSearch,
        error,
        itemsPerPage,
        setItemsPerPage,
        readOnlyMode,
        primaryKeys,
        tableStats,
        isLoadingStats,
        schemaMap,
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
        queryTabResults,
        isQueryTab: activeTabId?.startsWith('query:') ?? false,
        openEditorTab,
        isEditorTab: activeTabId?.startsWith('editor:') ?? false,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
