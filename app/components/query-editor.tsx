'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { EditorView } from '@codemirror/view';
import { Card } from './ui/card';
import { DataTable } from './data-table';
import { ErrorState } from './error-state';
import { SqlEditor } from './sql-editor';
import { useQueryHistory } from '../hooks/use-query-history';
import { QueryHistory } from './query-history';
import { formatSQL } from '@/lib/sql-formatter';
import { getStatementAtCursor } from '@/lib/sql-statements';
import { api } from '@/lib/api';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { useToast } from '../contexts/toast-context';
import { useQuery } from '@tanstack/react-query';
import { pgOidToType } from '@/lib/pg-types';
import { analyzeEditability, describeReason, type EditabilityResult } from '@/lib/query-editability';
import type { QueryFieldInfo } from '@/lib/db-provider';
import type { ColumnInfo } from '@/types';
import type { MutationRequest } from '@/lib/mutation';
import { buildDisplaySQL } from '@/lib/mutation';
import { MutationConfirmation } from './mutation-confirmation';
import { QueryExecutionConfirmation } from './query-execution-confirmation';
import { TabBar, type Tab } from './tab-bar';
import { SaveQueryDialog } from './save-query-dialog';

interface PendingQueryConfirmation {
  sql: string;
  kind: 'write' | 'ddl';
  statement: string;
  isBulkWrite: boolean;
  requiresTypedConfirmation: boolean;
}

interface ResultTab {
  id: string;
  label: string;
  /** the exact SQL that produced this tab — used for dedup and refresh */
  sql: string;
  rows: any[];
  columns: string[];
  columnTypes: Record<string, string>;
  executionTime: number;
  /** field metadata returned by the driver — drives editability detection */
  fields?: QueryFieldInfo[];
}

interface QueryEditorProps {
  isActive?: boolean;
  tabId?: string;
}

const editorStorageKey = (tabId: string) => `dbview-editor-${tabId}`;

export const QueryEditor: React.FC<QueryEditorProps> = ({ isActive = true, tabId }) => {
  const { databaseType } = useConnection();
  const { schemaMap, tables, selectedSchema, mutateRow, saveQuery } = useDashboard();
  const { addToast } = useToast();
  const [query, setQuery] = useState<string>(() => {
    if (!tabId || typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(editorStorageKey(tabId)) ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!tabId || typeof window === 'undefined') return;
    try {
      if (query) {
        localStorage.setItem(editorStorageKey(tabId), query);
      } else {
        localStorage.removeItem(editorStorageKey(tabId));
      }
    } catch {
      // ignore
    }
  }, [query, tabId]);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const editorViewRef = useRef<EditorView | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [pendingMutation, setPendingMutation] = useState<MutationRequest | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingQueryConfirm, setPendingQueryConfirm] = useState<PendingQueryConfirmation | null>(null);

  // Result tabs
  const [resultTabs, setResultTabs] = useState<ResultTab[]>([]);
  const [activeResultTabId, setActiveResultTabId] = useState<string | undefined>();
  const [resultSearchQuery, setResultSearchQuery] = useState('');
  const resultSearchInputRef = useRef<HTMLInputElement>(null);
  const [isSaveQueryOpen, setIsSaveQueryOpen] = useState(false);
  const [pendingSaveQuery, setPendingSaveQuery] = useState('');

  const getExecutableQuery = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      const { from, to, head } = view.state.selection.main;
      if (from !== to) {
        return view.state.sliceDoc(from, to).trim();
      }
      // No selection → run only the statement at the cursor. Use the live
      // editor doc rather than the throttled `query` state so we always get
      // the current text.
      const doc = view.state.doc.toString();
      const stmt = getStatementAtCursor(doc, head);
      if (stmt) return stmt.text;
    }
    return query.trim();
  }, [query]);

  const autocompleteSchema = useMemo(() => {
    // Build a flat { table: columns[] } map and also a nested { schema: { table: columns[] } }
    // so CodeMirror can resolve both bare-table references and schema-qualified ones.
    const flat: Record<string, string[]> =
      Object.keys(schemaMap).length > 0
        ? schemaMap
        : tables.reduce<Record<string, string[]>>((acc, t) => {
            acc[t] = [];
            return acc;
          }, {});
    return { ...flat, [selectedSchema]: flat };
  }, [schemaMap, tables, selectedSchema]);

  const { history, addQuery, favoriteQuery, deleteQuery, clearHistory } = useQueryHistory();

  const parseColumnTypes = (data: any) => {
    if (data.fields && Array.isArray(data.fields)) {
      const types: Record<string, string> = {};
      for (const field of data.fields) {
        types[field.name] = pgOidToType(field.dataTypeID);
      }
      return types;
    }
    return {};
  };

  // Run a query and write the results to a tab. Re-running the same SQL
  // string focuses the existing tab and refreshes its rows in place rather
  // than creating a duplicate. This is the spec from the doc: every run
  // gets a tab; results never clobber.
  const executeQueryRequest = useCallback(
    async (execQuery: string, confirmed = false) => {
      setIsExecuting(true);
      setError(null);

      try {
        const data = await api.post(
          '/api/query',
          { query: execQuery, confirmed },
          { noRetry: true }
        );

        if (data.needsConfirmation) {
          const c = data.classification;
          setPendingQueryConfirm({
            sql: data.preview,
            kind: c.kind,
            statement: c.statement,
            isBulkWrite: c.isBulkWrite,
            requiresTypedConfirmation: c.requiresTypedConfirmation,
          });
          return;
        }

        const rows = data.rows || [];
        const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
        const columnTypes = parseColumnTypes(data);
        const fields = data.fields as QueryFieldInfo[] | undefined;
        const execTime = data.executionTime || 0;
        const label = execQuery.length > 30 ? execQuery.slice(0, 30) + '...' : execQuery;

        const existingId = resultTabs.find((t) => t.sql === execQuery)?.id;
        const tabId =
          existingId ?? `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        setResultTabs((prev) => {
          const idx = prev.findIndex((t) => t.sql === execQuery);
          if (idx >= 0) {
            const updated: ResultTab = {
              ...prev[idx],
              rows,
              columns: cols,
              columnTypes,
              executionTime: execTime,
              fields,
            };
            return prev.map((t, i) => (i === idx ? updated : t));
          }
          return [
            ...prev,
            {
              id: tabId,
              label,
              sql: execQuery,
              rows,
              columns: cols,
              columnTypes,
              executionTime: execTime,
              fields,
            },
          ];
        });
        setActiveResultTabId(tabId);
        addQuery(execQuery, execTime, rows.length);
      } catch (err: any) {
        setError(err.message || 'Query execution failed');
      } finally {
        setIsExecuting(false);
      }
    },
    [addQuery, resultTabs]
  );

  const handleExecute = async () => {
    const execQuery = getExecutableQuery();
    if (!execQuery) return;
    await executeQueryRequest(execQuery);
  };

  const handleConfirmQueryExecution = useCallback(async () => {
    if (!pendingQueryConfirm) return;
    const sql = pendingQueryConfirm.sql;
    setPendingQueryConfirm(null);
    await executeQueryRequest(sql, true);
  }, [pendingQueryConfirm, executeQueryRequest]);

  useHotkeys(
    'ctrl+enter, meta+enter',
    (e) => {
      e.preventDefault();
      handleExecute();
    },
    {
      enabled: isActive,
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    }
  );

  useHotkeys(
    'ctrl+f, meta+f',
    (e) => {
      e.preventDefault();
      resultSearchInputRef.current?.focus();
      resultSearchInputRef.current?.select();
    },
    {
      enabled: isActive && resultTabs.length > 0,
      preventDefault: true,
    }
  );

  // ─── Result editability (per active tab) ──────────────────────
  // Look up here so the rest of the component can read derived state from
  // the active tab without scattered `find` calls.
  const activeTab = resultTabs.find((t) => t.id === activeResultTabId);
  const activeFields = activeTab?.fields;
  const activeSql = activeTab?.sql ?? '';

  // Detect the unique source (schema, table) from the result fields.
  const candidateSource = useMemo(() => {
    if (!activeFields || activeFields.length === 0) return null;
    const seen = new Set<string>();
    let schema = '';
    let table = '';
    for (const f of activeFields) {
      if (f.source) {
        const key = `${f.source.schema}.${f.source.table}`;
        if (!seen.has(key)) {
          seen.add(key);
          schema = f.source.schema;
          table = f.source.table;
        }
      }
    }
    return seen.size === 1 ? { schema, table } : null;
  }, [activeFields]);

  const sourceSchemaQuery = useQuery({
    queryKey: ['queryResultSourceSchema', candidateSource?.schema, candidateSource?.table],
    queryFn: async () => {
      const data = await api.get(
        `/api/schema/${encodeURIComponent(candidateSource!.table)}?schema=${encodeURIComponent(candidateSource!.schema)}`
      );
      return ((data.schema || []) as any[]).map((row: any) => ({
        name: row.column_name ?? row.name,
        type: row.data_type ?? row.type,
        nullable: row.is_nullable === 'YES' || row.nullable === true,
        default: row.column_default ?? row.default ?? null,
        isPrimaryKey: row.is_primary_key ?? row.isPrimaryKey ?? false,
      })) as ColumnInfo[];
    },
    enabled: !!candidateSource,
  });

  const sourceColumnInfo = useMemo(() => sourceSchemaQuery.data ?? [], [sourceSchemaQuery.data]);
  const sourcePrimaryKeys = useMemo(
    () => sourceColumnInfo.filter((c) => c.isPrimaryKey).map((c) => c.name),
    [sourceColumnInfo]
  );

  const editability: EditabilityResult = useMemo(() => {
    return analyzeEditability({
      sql: activeSql,
      fields: activeFields,
      getPrimaryKeys: (schema, table) => {
        if (
          candidateSource?.schema === schema &&
          candidateSource?.table === table &&
          sourcePrimaryKeys.length > 0
        ) {
          return sourcePrimaryKeys;
        }
        return undefined;
      },
    });
  }, [activeSql, activeFields, candidateSource, sourcePrimaryKeys]);

  // When editable: derive per-row-lookup PKs (result-aliased) and
  // the set of read-only result columns (computed expressions, etc.).
  const editableMeta = useMemo(() => {
    if (!editability.editable) return null;
    if (!activeTab) return null;
    const { columnToSource, primaryKeys: basePks, schema, table } = editability;
    const resultPrimaryKeys = activeTab.columns.filter((c) => basePks.includes(columnToSource[c] ?? ''));
    const readOnlyResultColumns = activeTab.columns.filter((c) => !(c in columnToSource));
    return { schema, table, columnToSource, resultPrimaryKeys, readOnlyResultColumns };
  }, [editability, activeTab]);

  // Translate a row's result-aliased PKs back to base-table column names.
  const buildBaseWhere = useCallback(
    (rowPks: Record<string, any>): Record<string, any> | null => {
      if (!editableMeta) return null;
      const where: Record<string, any> = {};
      for (const [resultCol, val] of Object.entries(rowPks)) {
        const baseCol = editableMeta.columnToSource[resultCol];
        if (!baseCol) return null;
        where[baseCol] = val;
      }
      return where;
    },
    [editableMeta]
  );

  const handleQueryCellUpdate = useCallback(
    ({ pks, column, next }: { pks: Record<string, any>; column: string; original: any; next: any }) => {
      if (!editableMeta) return;
      const baseColumn = editableMeta.columnToSource[column];
      const where = buildBaseWhere(pks);
      if (!baseColumn || !where) return;
      setPendingMutation({
        type: 'UPDATE',
        schema: editableMeta.schema,
        table: editableMeta.table,
        values: { [baseColumn]: next },
        where,
      });
    },
    [editableMeta, buildBaseWhere]
  );

  const handleQueryRowDelete = useCallback(
    ({ pks }: { pks: Record<string, any>; snapshot: Record<string, any> }) => {
      if (!editableMeta) return;
      const where = buildBaseWhere(pks);
      if (!where) return;
      setPendingMutation({
        type: 'DELETE',
        schema: editableMeta.schema,
        table: editableMeta.table,
        where,
      });
    },
    [editableMeta, buildBaseWhere]
  );

  // Re-run the query backing the active tab and refresh its rows in place.
  const refreshResults = useCallback(async () => {
    if (!activeTab) return;
    await executeQueryRequest(activeTab.sql);
  }, [activeTab, executeQueryRequest]);

  const handleConfirmMutation = useCallback(async () => {
    if (!pendingMutation) return;
    setIsMutating(true);
    try {
      await mutateRow(pendingMutation);
      setPendingMutation(null);
      await refreshResults();
    } catch (err: any) {
      addToast(err.message || 'Mutation failed', 'error');
    } finally {
      setIsMutating(false);
    }
  }, [pendingMutation, mutateRow, refreshResults, addToast]);

  const closeResultTab = useCallback((tabId: string) => {
    setResultTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (tabId === activeResultTabId) {
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        const newActive = next[Math.min(closedIndex, next.length - 1)];
        setActiveResultTabId(newActive?.id);
      }
      return next;
    });
  }, [activeResultTabId]);

  const handleClear = () => {
    setQuery('');
    setError(null);
  };

  const tabBarTabs: Tab[] = resultTabs.map((t) => ({
    id: t.id,
    label: t.label,
    type: 'query' as const,
  }));

  return (
    <div className="space-y-4">
      <Card title="SQL query">
        <div className="space-y-3">
          <div className="flex border border-border rounded-md overflow-hidden">
            <div className="flex flex-col items-center gap-1 px-1.5 py-2 bg-bg-secondary/40 border-r border-border">
              <button
                onClick={handleExecute}
                disabled={isExecuting || !query.trim()}
                className="w-7 h-7 flex items-center justify-center rounded text-green-500 hover:bg-green-500/15 disabled:opacity-30 transition-colors"
                title={hasSelection ? 'Run Selection (Ctrl+Enter)' : 'Execute (Ctrl+Enter)'}
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
              </button>
              <div className="w-5 border-t border-border my-0.5" />
              <button
                onClick={() => setQuery(formatSQL(query, databaseType))}
                disabled={isExecuting || !query.trim()}
                className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-bg-secondary disabled:opacity-30 transition-colors"
                title="Format SQL"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="10" height="2" rx="1"/><rect x="1" y="12" width="12" height="2" rx="1"/></svg>
              </button>
              <button
                onClick={() => {
                  setPendingSaveQuery(query);
                  setIsSaveQueryOpen(true);
                }}
                disabled={isExecuting || !query.trim()}
                className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-30 transition-colors"
                title="Save query"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M11 1H3a1 1 0 00-1 1v12l4-3 4 3V2a1 1 0 00-1-1z"/></svg>
              </button>
              <button
                onClick={handleClear}
                disabled={isExecuting}
                className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors"
                title="Clear"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${showHistory ? 'text-accent bg-accent/15' : 'text-muted hover:text-primary hover:bg-bg-secondary'}`}
                title="History"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2.5 2.5"/></svg>
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <SqlEditor
                value={query}
                onChange={setQuery}
                disabled={isExecuting}
                schema={autocompleteSchema}
                defaultSchema={selectedSchema}
                editorRef={editorViewRef}
                onSelectionChange={setHasSelection}
              />
            </div>
          </div>
          {error && (
            <ErrorState
              message={error}
              onRetry={query.trim() ? handleExecute : undefined}
            />
          )}
          {showHistory && (
            <QueryHistory
              entries={history}
              onSelect={(sql) => {
                setQuery(sql);
                setShowHistory(false);
              }}
              onFavorite={favoriteQuery}
              onDelete={deleteQuery}
              onClear={clearHistory}
              onSave={(sql) => {
                setPendingSaveQuery(sql);
                setIsSaveQueryOpen(true);
              }}
            />
          )}
        </div>
      </Card>

      {/* Result tabs bar */}
      {resultTabs.length > 0 && (
        <TabBar
          tabs={tabBarTabs}
          activeTabId={activeResultTabId}
          onTabSelect={(tabId) => setActiveResultTabId(tabId)}
          onTabClose={closeResultTab}
          onTabCloseAll={() => { setResultTabs([]); setActiveResultTabId(undefined); }}
        />
      )}

      {/* Query execution indicator */}
      {isExecuting && (
        <div className="flex items-center gap-3 py-3 px-1">
          <div className="relative h-1 flex-1 bg-bg-secondary rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-accent rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
          </div>
          <span className="text-xs text-muted flex-shrink-0">Running query...</span>
          <style jsx>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>
        </div>
      )}

      {/* Active result tab content */}
      {activeTab && (
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-sm text-muted">
              {activeTab.rows.length} {activeTab.rows.length === 1 ? 'row' : 'rows'} returned
            </span>
            <div className="flex items-center gap-2">
              {editableMeta ? (
                <span
                  className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                  title={`Editable — ${editableMeta.schema}.${editableMeta.table}`}
                >
                  Editable
                </span>
              ) : editability.editable === false && activeFields && activeFields.length > 0 ? (
                <span
                  className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-bg-secondary text-muted"
                  title={`Read-only — ${describeReason(editability.reason)}${editability.detail ? ` (${editability.detail})` : ''}`}
                >
                  Read-only
                </span>
              ) : null}
              <input
                ref={resultSearchInputRef}
                type="text"
                value={resultSearchQuery}
                onChange={(e) => setResultSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setResultSearchQuery('');
                    resultSearchInputRef.current?.blur();
                  }
                }}
                placeholder="Find in result..."
                className="px-2 py-1 text-xs border border-border rounded bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted w-40"
                aria-label="Find in result"
              />
              <span className="text-sm text-muted font-mono">{activeTab.executionTime}ms</span>
              <button
                onClick={refreshResults}
                disabled={isExecuting}
                className="p-1 text-muted hover:text-primary hover:bg-bg-secondary rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Refresh results (re-run this tab's query)"
                aria-label="Refresh results"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isExecuting ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          {activeTab.rows.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted">
              Query executed successfully. No rows returned.
            </div>
          ) : (
            <DataTable
              columns={activeTab.columns}
              data={activeTab.rows}
              isLoading={false}
              columnTypes={activeTab.columnTypes}
              searchQuery={resultSearchQuery}
              primaryKeys={editableMeta?.resultPrimaryKeys}
              columnSchema={editableMeta ? sourceColumnInfo : undefined}
              onCellUpdate={editableMeta ? handleQueryCellUpdate : undefined}
              onRowDelete={editableMeta ? handleQueryRowDelete : undefined}
              readOnlyColumns={editableMeta?.readOnlyResultColumns}
            />
          )}
        </div>
      )}

      {!activeTab && resultTabs.length === 0 && !isExecuting && !error && (
        <div className="text-center py-6 text-sm text-muted">
          Run a query to see results here.
        </div>
      )}

      {pendingMutation && (
        <MutationConfirmation
          isOpen={!!pendingMutation}
          type={pendingMutation.type}
          sql={buildDisplaySQL(pendingMutation, databaseType)}
          onConfirm={handleConfirmMutation}
          onCancel={() => setPendingMutation(null)}
          isLoading={isMutating}
        />
      )}

      {pendingQueryConfirm && (
        <QueryExecutionConfirmation
          isOpen={!!pendingQueryConfirm}
          sql={pendingQueryConfirm.sql}
          statement={pendingQueryConfirm.statement}
          kind={pendingQueryConfirm.kind}
          isBulkWrite={pendingQueryConfirm.isBulkWrite}
          requiresTypedConfirmation={pendingQueryConfirm.requiresTypedConfirmation}
          onConfirm={handleConfirmQueryExecution}
          onCancel={() => setPendingQueryConfirm(null)}
          isLoading={isExecuting}
        />
      )}

      <SaveQueryDialog
        isOpen={isSaveQueryOpen}
        onClose={() => setIsSaveQueryOpen(false)}
        onSave={(name, tags) => {
          saveQuery(name, pendingSaveQuery, tags);
          addToast(`Saved "${name}"`, 'success');
        }}
        query={pendingSaveQuery}
      />
    </div>
  );
};
