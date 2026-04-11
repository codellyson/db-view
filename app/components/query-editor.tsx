'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { EditorView } from '@codemirror/view';
import { Card } from './ui/card';
import { DataTable } from './data-table';
import { ErrorState } from './error-state';
import { SqlEditor } from './sql-editor';
import { useQueryHistory } from '../hooks/use-query-history';
import { QueryHistory } from './query-history';
import { formatSQL } from '@/lib/sql-formatter';
import { api } from '@/lib/api';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { pgOidToType } from '@/lib/pg-types';
import { TabBar, type Tab } from './tab-bar';

interface ResultTab {
  id: string;
  label: string;
  rows: any[];
  columns: string[];
  columnTypes: Record<string, string>;
  executionTime: number;
}

interface QueryEditorProps {
  isActive?: boolean;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({ isActive = true }) => {
  const { databaseType } = useConnection();
  const { schemaMap, tables, selectedSchema } = useDashboard();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [resultColumnTypes, setResultColumnTypes] = useState<Record<string, string>>({});
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const editorViewRef = useRef<EditorView | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  // Result tabs
  const [resultTabs, setResultTabs] = useState<ResultTab[]>([]);
  const [activeResultTabId, setActiveResultTabId] = useState<string | undefined>();

  const getExecutableQuery = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      const { from, to } = view.state.selection.main;
      if (from !== to) {
        return view.state.sliceDoc(from, to).trim();
      }
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

  const handleExecute = async () => {
    const execQuery = getExecutableQuery();
    if (!execQuery) return;

    setIsExecuting(true);
    setError(null);
    setResults([]);
    setColumns([]);
    setExecutionTime(null);

    try {
      const data = await api.post('/api/query', { query: execQuery }, { noRetry: true });
      const rows = data.rows || [];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      setColumns(cols);
      setResultColumnTypes(parseColumnTypes(data));
      setResults(rows);
      setExecutionTime(data.executionTime || null);
      addQuery(execQuery, data.executionTime || 0, rows.length);
      // Deselect any result tab so inline results show
      setActiveResultTabId(undefined);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
      setResults([]);
      setColumns([]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteToTab = async () => {
    const execQuery = getExecutableQuery();
    if (!execQuery) return;

    setIsExecuting(true);
    setError(null);

    try {
      const data = await api.post('/api/query', { query: execQuery }, { noRetry: true });
      const rows = data.rows || [];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      const label = execQuery.length > 30 ? execQuery.slice(0, 30) + '...' : execQuery;
      const tabId = `qr_${Date.now()}`;

      const newTab: ResultTab = {
        id: tabId,
        label,
        rows,
        columns: cols,
        columnTypes: parseColumnTypes(data),
        executionTime: data.executionTime || 0,
      };

      setResultTabs((prev) => [...prev, newTab]);
      setActiveResultTabId(tabId);
      addQuery(execQuery, data.executionTime || 0, rows.length);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

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
    setResults([]);
    setColumns([]);
    setError(null);
    setExecutionTime(null);
  };

  // What to show in results area
  const activeTab = resultTabs.find((t) => t.id === activeResultTabId);
  const showInlineResults = !activeResultTabId && results.length > 0;

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
              <button
                onClick={handleExecuteToTab}
                disabled={isExecuting || !query.trim()}
                className="w-7 h-7 flex items-center justify-center rounded text-blue-400 hover:bg-blue-400/15 disabled:opacity-30 transition-colors"
                title={hasSelection ? 'Selection to Tab' : 'Run to Tab'}
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2l8 5-8 5V2z"/><rect x="11" y="3" width="3" height="10" rx="0.5"/></svg>
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
            />
          )}
        </div>
      </Card>

      {/* Result tabs bar */}
      {(resultTabs.length > 0 || showInlineResults) && (
        <TabBar
          tabs={tabBarTabs}
          activeTabId={activeResultTabId}
          onTabSelect={(tabId) => setActiveResultTabId(tabId)}
          onTabClose={closeResultTab}
          onTabCloseAll={() => { setResultTabs([]); setActiveResultTabId(undefined); }}
          actions={
            showInlineResults || (!activeResultTabId && results.length === 0) ? undefined : (
              <button
                onClick={() => setActiveResultTabId(undefined)}
                className={`p-1.5 rounded transition-colors ${!activeResultTabId ? 'text-accent bg-accent/10' : 'text-muted hover:text-primary hover:bg-bg-secondary'}`}
                title="Show inline result"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
              </button>
            )
          }
        />
      )}

      {/* Active result tab content */}
      {activeTab && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">
              {activeTab.rows.length} {activeTab.rows.length === 1 ? 'row' : 'rows'} returned
            </span>
            <span className="text-sm text-muted font-mono">{activeTab.executionTime}ms</span>
          </div>
          <DataTable columns={activeTab.columns} data={activeTab.rows} isLoading={false} columnTypes={activeTab.columnTypes} />
        </div>
      )}

      {/* Inline results (no tab selected) */}
      {showInlineResults && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">
              {results.length} {results.length === 1 ? 'row' : 'rows'} returned
            </span>
            {executionTime !== null && (
              <span className="text-sm text-muted font-mono">{executionTime}ms</span>
            )}
          </div>
          <DataTable columns={columns} data={results} isLoading={false} columnTypes={resultColumnTypes} />
        </div>
      )}

      {results.length === 0 && !activeTab && !error && executionTime !== null && (
        <div className="text-center py-6 text-sm text-muted">
          Query executed successfully. No rows returned.
        </div>
      )}
    </div>
  );
};
