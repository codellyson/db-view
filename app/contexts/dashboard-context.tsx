'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useConnection } from './connection-context';
import { useToast } from './toast-context';
import { ColumnInfo } from '@/types';
import { buildDisplaySQL, type MutationRequest } from '@/lib/mutation';
import { type TableStatsData } from '../components/table-stats';

interface DashboardContextType {
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
  readOnlyMode: boolean;
  primaryKeys: string[];
  tableStats: TableStatsData | null;
  isLoadingStats: boolean;
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
  const { isConnected } = useConnection();
  const { addToast } = useToast();
  const itemsPerPage = 100;

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

  const primaryKeys = useMemo(() => {
    return schema.filter((col) => col.isPrimaryKey).map((col) => col.name);
  }, [schema]);

  // Track whether initial data has been loaded for the current connection
  const hasLoadedRef = useRef(false);

  const loadSchemas = useCallback(async () => {
    try {
      const response = await fetch('/api/schemas');
      if (response.ok) {
        const data = await response.json();
        setSchemas(data.schemas || []);
      }
    } catch (err) {
      console.error('Failed to load schemas:', err);
    }
  }, []);

  const loadViewsAndFunctions = useCallback(async (schemaName?: string) => {
    const s = schemaName || selectedSchema;
    try {
      const [viewsRes, functionsRes] = await Promise.all([
        fetch(`/api/views?schema=${encodeURIComponent(s)}`),
        fetch(`/api/functions?schema=${encodeURIComponent(s)}`),
      ]);
      if (viewsRes.ok) {
        const data = await viewsRes.json();
        setViews(data.views || []);
        setMaterializedViews(data.materializedViews || []);
      }
      if (functionsRes.ok) {
        const data = await functionsRes.json();
        setDbFunctions(data.functions || []);
      }
    } catch (err) {
      console.error('Failed to load views/functions:', err);
    }
  }, [selectedSchema]);

  const loadTables = useCallback(async (schemaName?: string) => {
    const s = schemaName || selectedSchema;
    setIsLoadingTables(true);
    setError(null);
    try {
      const response = await fetch(`/api/tables?schema=${encodeURIComponent(s)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load tables');
      }
      const data = await response.json();
      setTables(data.tables || []);
    } catch (err: any) {
      console.error('Error loading tables:', err);
      setError(err.message || 'Failed to load tables');
      addToast(err.message || 'FAILED TO LOAD TABLES', 'error');
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
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load table data');
      }
      const data = await response.json();
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
  }, [selectedSchema, sortColumn, sortDirection]);

  const loadTableSchema = useCallback(async (tableName: string) => {
    setIsLoadingSchema(true);
    try {
      const response = await fetch(
        `/api/schema/${encodeURIComponent(tableName)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      if (!response.ok) throw new Error('Failed to load schema');
      const data = await response.json();
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
      const response = await fetch(
        `/api/relationships/${encodeURIComponent(tableName)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      if (response.ok) {
        const data = await response.json();
        setRelationships(data.relationships || []);
        setIndexes(data.indexes || []);
      }
    } catch (err) {
      console.error('Failed to load relationships:', err);
    }
  }, [selectedSchema]);

  const loadTableStats = useCallback(async (tableName: string) => {
    setIsLoadingStats(true);
    try {
      const response = await fetch(
        `/api/table-stats/${encodeURIComponent(tableName)}?schema=${encodeURIComponent(selectedSchema)}`
      );
      if (response.ok) {
        const data = await response.json();
        setTableStats(data.stats || null);
      }
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
    const response = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setReadOnlyMode(true);
      }
      throw new Error(data.error || 'Mutation failed');
    }

    addToast(`${request.type} SUCCESSFUL`, 'success');
    await refreshTableData();
  }, [addToast, refreshTableData]);

  const handleSchemaChange = useCallback((newSchema: string) => {
    setSelectedSchema(newSchema);
    setSelectedTable(undefined);
    setTableData([]);
    setColumns([]);
    loadTables(newSchema);
    loadViewsAndFunctions(newSchema);
  }, [loadTables, loadViewsAndFunctions]);

  const handleTableSelect = useCallback((table: string) => {
    setSelectedTable(table);
    setCurrentPage(1);
    setSortColumn(null);
    setSortDirection(null);
    setVisibleColumns([]);
    setTableSearch('');
  }, []);

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
      loadSchemas();
      loadTables();
      loadViewsAndFunctions();
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
      setError(null);
    }
  }, [isConnected, loadSchemas, loadTables, loadViewsAndFunctions]);

  // Load table data when selected table or pagination/sort changes
  useEffect(() => {
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
        readOnlyMode,
        primaryKeys,
        tableStats,
        isLoadingStats,
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
