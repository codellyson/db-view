'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useConnection } from './connection-context';
import { useToast } from './toast-context';
import { ColumnInfo } from '@/types';
import { buildDisplaySQL, type MutationRequest } from '@/lib/mutation';
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
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, databaseType, databaseName } = useConnection();
  const { addToast } = useToast();
  const [itemsPerPage, setItemsPerPage] = useState(100);

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [tableData, setTableData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [relationships, setRelationships] = useState<any[]>([]);
  const [indexes, setIndexes] = useState<any[]>([]);
  const [views, setViews] = useState<string[]>([]);
  const [materializedViews, setMaterializedViews] = useState<string[]>([]);
  const [dbFunctions, setDbFunctions] = useState<any[]>([]);
  const [countIsEstimate, setCountIsEstimate] = useState(false);
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [tableStats, setTableStats] = useState<TableStatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [schemaMap, setSchemaMap] = useState<Record<string, string[]>>({});
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | undefined>();

  // Per-tab data cache to avoid re-fetching on tab switch
  interface TabCache {
    tableData: any[];
    columns: string[];
    schema: ColumnInfo[];
    relationships: any[];
    indexes: any[];
    currentPage: number;
    totalItems: number;
    countIsEstimate: boolean;
    sortColumn: string | null;
    sortDirection: 'asc' | 'desc' | null;
    visibleColumns: string[];
    tableSearch: string;
    tableStats: TableStatsData | null;
    error: string | null;
  }
  const tabCacheRef = useRef<Record<string, TabCache>>({});

  const saveCurrentTabCache = useCallback(() => {
    if (!activeTabId) return;
    tabCacheRef.current[activeTabId] = {
      tableData,
      columns,
      schema,
      relationships,
      indexes,
      currentPage,
      totalItems,
      countIsEstimate,
      sortColumn,
      sortDirection,
      visibleColumns,
      tableSearch,
      tableStats,
      error,
    };
  }, [activeTabId, tableData, columns, schema, relationships, indexes, currentPage, totalItems, countIsEstimate, sortColumn, sortDirection, visibleColumns, tableSearch, tableStats, error]);

  const restoreTabCache = useCallback((tabId: string): boolean => {
    const cached = tabCacheRef.current[tabId];
    if (!cached) return false;
    setTableData(cached.tableData);
    setColumns(cached.columns);
    setSchema(cached.schema);
    setRelationships(cached.relationships);
    setIndexes(cached.indexes);
    setCurrentPage(cached.currentPage);
    setTotalItems(cached.totalItems);
    setCountIsEstimate(cached.countIsEstimate);
    setSortColumn(cached.sortColumn);
    setSortDirection(cached.sortDirection);
    setVisibleColumns(cached.visibleColumns);
    setTableSearch(cached.tableSearch);
    setTableStats(cached.tableStats);
    setError(cached.error);
    return true;
  }, []);

  const clearTabCache = useCallback((tabId: string) => {
    delete tabCacheRef.current[tabId];
  }, []);

  // Track whether we just restored from cache to skip re-fetching
  const restoredFromCacheRef = useRef(false);

  const restoreTabCacheWithFlag = useCallback((tabId: string): boolean => {
    const restored = restoreTabCache(tabId);
    if (restored) restoredFromCacheRef.current = true;
    return restored;
  }, [restoreTabCache]);

  const primaryKeys = useMemo(() => {
    return schema.filter((col) => col.isPrimaryKey).map((col) => col.name);
  }, [schema]);

  // Track whether initial data has been loaded for the current connection
  const hasLoadedRef = useRef(false);

  const loadSchemas = useCallback(async () => {
    try {
      const data = await api.get('/api/schemas');
      setSchemas(data.schemas || []);
    } catch (err) {
      console.error('Failed to load schemas:', err);
    }
  }, []);

  const loadSchemaMap = useCallback(async (schemaName?: string) => {
    const s = schemaName || selectedSchema;
    try {
      const data = await api.get(`/api/schema-map?schema=${encodeURIComponent(s)}`);
      setSchemaMap(data.schemaMap || {});
    } catch (err) {
      console.error('Failed to load schema map:', err);
    }
  }, [selectedSchema]);

  const loadViewsAndFunctions = useCallback(async (schemaName?: string) => {
    const s = schemaName || selectedSchema;
    try {
      const [viewsData, functionsData] = await Promise.all([
        api.get(`/api/views?schema=${encodeURIComponent(s)}`),
        api.get(`/api/functions?schema=${encodeURIComponent(s)}`),
      ]);
      setViews(viewsData.views || []);
      setMaterializedViews(viewsData.materializedViews || []);
      setDbFunctions(functionsData.functions || []);
    } catch (err) {
      console.error('Failed to load views/functions:', err);
    }
  }, [selectedSchema]);

  const loadTables = useCallback(async (schemaName?: string) => {
    const s = schemaName || selectedSchema;
    setIsLoadingTables(true);
    setError(null);
    try {
      const data = await api.get(`/api/tables?schema=${encodeURIComponent(s)}`);
      setTables(data.tables || []);
    } catch (err: any) {
      console.error('Error loading tables:', err);
      setError(err.message || 'Failed to load tables');
      addToast(err.message || 'Failed to load tables', 'error');
    } finally {
      setIsLoadingTables(false);
    }
  }, [selectedSchema, addToast]);

  const loadTableData = useCallback(async (tableName: string, page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * itemsPerPage;
      let url = `/api/table/${encodeURIComponent(tableName)}?limit=${itemsPerPage}&offset=${offset}&schema=${encodeURIComponent(selectedSchema)}`;
      if (sortColumn && sortDirection) {
        url += `&sortColumn=${encodeURIComponent(sortColumn)}&sortDirection=${sortDirection}`;
      }
      const data = await api.get(url);
      setTableData(data.rows || []);
      setTotalItems(data.total || 0);
      setCountIsEstimate(data.countIsEstimate || false);
      if (data.rows && data.rows.length > 0) {
        const cols = Object.keys(data.rows[0]);
        setColumns(cols);
        setVisibleColumns(cols);
      } else {
        setColumns([]);
        setVisibleColumns([]);
      }
    } catch (err: any) {
      setError(err.message);
      setTableData([]);
      setColumns([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchema, sortColumn, sortDirection, itemsPerPage]);

  const loadTableSchema = useCallback(async (tableName: string) => {
    setIsLoadingSchema(true);
    try {
      const data = await api.get(
        `/api/schema/${encodeURIComponent(tableName)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      const mapped: ColumnInfo[] = (data.schema || []).map((row: any) => ({
        name: row.column_name ?? row.name,
        type: row.data_type ?? row.type,
        nullable: row.is_nullable === 'YES' || row.nullable === true,
        default: row.column_default ?? row.default ?? null,
        isPrimaryKey: row.is_primary_key ?? row.isPrimaryKey ?? false,
      }));
      setSchema(mapped);
    } catch (err: any) {
      console.error('Failed to load schema:', err);
    } finally {
      setIsLoadingSchema(false);
    }
  }, [selectedSchema]);

  const loadRelationships = useCallback(async (tableName: string) => {
    try {
      const data = await api.get(
        `/api/relationships/${encodeURIComponent(tableName)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      setRelationships(data.relationships || []);
      setIndexes(data.indexes || []);
    } catch (err) {
      console.error('Failed to load relationships:', err);
    }
  }, [selectedSchema]);

  const loadTableStats = useCallback(async (tableName: string) => {
    setIsLoadingStats(true);
    try {
      const data = await api.get(
        `/api/table-stats/${encodeURIComponent(tableName)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      setTableStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load table stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [selectedSchema]);

  const refreshTableData = useCallback(async () => {
    if (selectedTable) {
      await loadTableData(selectedTable, currentPage);
    }
  }, [selectedTable, currentPage, loadTableData]);

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

  const openTab = useCallback((name: string, type: Tab['type'] = 'table') => {
    const tabId = `${type}:${name}`;
    // Already on this tab — no-op
    if (tabId === activeTabId) return;
    // Save current tab's state before switching
    saveCurrentTabCache();
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      return [...prev, { id: tabId, label: name, type }];
    });
    setActiveTabId(tabId);
    setSelectedTable(name);
    // Try to restore from cache; if no cache, reset for fresh load
    if (!restoreTabCacheWithFlag(tabId)) {
      setCurrentPage(1);
      setSortColumn(null);
      setSortDirection(null);
      setVisibleColumns([]);
      setTableSearch('');
    }
  }, [activeTabId, saveCurrentTabCache, restoreTabCacheWithFlag]);

  const closeTab = useCallback((tabId: string) => {
    clearTabCache(tabId);
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        const newActive = next[Math.min(closedIndex, next.length - 1)];
        if (newActive) {
          setActiveTabId(newActive.id);
          setSelectedTable(newActive.label);
          if (!restoreTabCacheWithFlag(newActive.id)) {
            setCurrentPage(1);
            setSortColumn(null);
            setSortDirection(null);
            setVisibleColumns([]);
            setTableSearch('');
          }
        } else {
          setActiveTabId(undefined);
          setSelectedTable(undefined);
          setTableData([]);
          setColumns([]);
        }
      }
      return next;
    });
  }, [activeTabId, clearTabCache, restoreTabCacheWithFlag]);

  const setActiveTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    saveCurrentTabCache();
    setActiveTabId(tabId);
    setOpenTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (tab) {
        setSelectedTable(tab.label);
        if (!restoreTabCacheWithFlag(tabId)) {
          setCurrentPage(1);
          setSortColumn(null);
          setSortDirection(null);
          setVisibleColumns([]);
          setTableSearch('');
        }
      }
      return prev;
    });
  }, [activeTabId, saveCurrentTabCache, restoreTabCacheWithFlag]);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabId(undefined);
    setSelectedTable(undefined);
    setTableData([]);
    setColumns([]);
  }, []);

  const closeOtherTabs = useCallback((tabId: string) => {
    setOpenTabs((prev) => prev.filter((t) => t.id === tabId));
    setActiveTabId(tabId);
  }, []);

  const handleSchemaChange = useCallback((newSchema: string) => {
    setSelectedSchema(newSchema);
    setSelectedTable(undefined);
    setTableData([]);
    setColumns([]);
    setOpenTabs([]);
    setActiveTabId(undefined);
    loadTables(newSchema);
    loadViewsAndFunctions(newSchema);
    loadSchemaMap(newSchema);
  }, [loadTables, loadViewsAndFunctions, loadSchemaMap]);

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

  // Load initial data when connection is established (only once)
  useEffect(() => {
    if (isConnected && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // MySQL uses database name as schema; PostgreSQL defaults to "public"
      const defaultSchema = databaseType === 'mysql' && databaseName ? databaseName : 'public';
      setSelectedSchema(defaultSchema);
      loadSchemas();
      loadTables(defaultSchema);
      loadViewsAndFunctions(defaultSchema);
      loadSchemaMap(defaultSchema);
    }
    if (!isConnected) {
      hasLoadedRef.current = false;
      setTables([]);
      setSelectedTable(undefined);
      setTableData([]);
      setColumns([]);
      setSchema([]);
      setSchemas([]);
      setViews([]);
      setMaterializedViews([]);
      setDbFunctions([]);
      setRelationships([]);
      setIndexes([]);
      setSchemaMap({});
      setOpenTabs([]);
      setActiveTabId(undefined);
      setError(null);
    }
  }, [isConnected, databaseType, databaseName, loadSchemas, loadTables, loadViewsAndFunctions, loadSchemaMap]);

  // Load table data when selected table or pagination/sort changes
  useEffect(() => {
    if (restoredFromCacheRef.current) {
      restoredFromCacheRef.current = false;
      return;
    }
    if (selectedTable) {
      loadTableData(selectedTable, currentPage);
      loadTableSchema(selectedTable);
      loadRelationships(selectedTable);
      loadTableStats(selectedTable);
    } else {
      setTableStats(null);
    }
  }, [selectedTable, currentPage, sortColumn, sortDirection, loadTableData, loadTableSchema, loadRelationships, loadTableStats]);

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
        loadRelationships,
        handleSchemaChange,
        handleTableSelect,
        handleSort,
        mutateRow,
        refreshTableData,
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
