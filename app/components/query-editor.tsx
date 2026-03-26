'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DataTable } from './data-table';
import { ErrorState } from './error-state';
import { SqlEditor } from './sql-editor';
import { ExplainPlan } from './explain-plan';
import { useQueryHistory } from '../hooks/use-query-history';
import { useSavedQueries } from '../hooks/use-saved-queries';
import { QueryHistory } from './query-history';
import { SavedQueriesPanel } from './saved-queries-panel';
import { SaveQueryDialog } from './save-query-dialog';
import { formatSQL } from '@/lib/sql-formatter';
import { api } from '@/lib/api';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { TemplateBrowser } from './template-browser';
import { TemplateEditor } from './template-editor';
import { QueryDiffView } from './query-diff-view';
import { usePlugins } from '../hooks/use-plugins';
import type { PinnedResult } from '@/types';
import { pgOidToType } from '@/lib/pg-types';

interface QueryEditorProps {}

export const QueryEditor: React.FC<QueryEditorProps> = () => {
  const { databaseType } = useConnection();
  const { schemaMap, tables, selectedSchema, loadTables } = useDashboard();
  const { addTemplate } = usePlugins();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [resultColumnTypes, setResultColumnTypes] = useState<Record<string, string>>({});
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [explainPlan, setExplainPlan] = useState<any[] | null>(null);
  const [viewMode, setViewMode] = useState<'results' | 'explain'>('results');
  const [pinnedResult, setPinnedResult] = useState<PinnedResult | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  // Ensure schemaMap is loaded for autocomplete even if user navigated directly to /query
  useEffect(() => {
    if (Object.keys(schemaMap).length === 0 && tables.length === 0) {
      loadTables();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build autocomplete schema: use schemaMap if available, otherwise fall back to table names
  const autocompleteSchema = useMemo(() => {
    if (Object.keys(schemaMap).length > 0) return schemaMap;
    // Fallback: table names without column info
    const fallback: Record<string, string[]> = {};
    for (const t of tables) {
      fallback[t] = [];
    }
    return fallback;
  }, [schemaMap, tables]);

  const { history, addQuery, favoriteQuery, deleteQuery, clearHistory } = useQueryHistory();
  const { savedQueries, saveQuery, deleteQuery: deleteSavedQuery, clearAll: clearSavedQueries } = useSavedQueries();

  const handleExecute = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResults([]);
    setColumns([]);
    setExecutionTime(null);
    setExplainPlan(null);
    setViewMode('results');

    try {
      const data = await api.post('/api/query', { query }, { noRetry: true });

      if (data.rows && data.rows.length > 0) {
        setColumns(Object.keys(data.rows[0]));
      } else {
        setColumns([]);
      }
      // Build column type map from pg field metadata
      if (data.fields && Array.isArray(data.fields)) {
        const types: Record<string, string> = {};
        for (const field of data.fields) {
          types[field.name] = pgOidToType(field.dataTypeID);
        }
        setResultColumnTypes(types);
      } else {
        setResultColumnTypes({});
      }
      const rows = data.rows || [];
      setResults(rows);
      setExecutionTime(data.executionTime || null);
      addQuery(query, data.executionTime || 0, rows.length);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
      setResults([]);
      setColumns([]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExplain = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setError(null);
    setExplainPlan(null);
    setViewMode('explain');

    try {
      const data = await api.post('/api/explain', { query }, { noRetry: true });

      setExplainPlan(data.plan);
      setExecutionTime(data.executionTime || null);
    } catch (err: any) {
      setError(err.message || 'Explain failed');
      setExplainPlan(null);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setColumns([]);
    setError(null);
    setExecutionTime(null);
    setExplainPlan(null);
    setViewMode('results');
  };

  const hasResults = results.length > 0 || explainPlan;

  return (
    <div className="space-y-4">
      <Card title="SQL query">
        <div className="space-y-4">
          <SqlEditor
            value={query}
            onChange={setQuery}
            onExecute={handleExecute}
            disabled={isExecuting}
            schema={autocompleteSchema}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                onClick={handleExecute}
                isLoading={isExecuting && viewMode === 'results'}
                disabled={isExecuting || !query.trim()}
              >
                Execute
              </Button>
              <Button
                variant="secondary"
                onClick={handleExplain}
                isLoading={isExecuting && viewMode === 'explain'}
                disabled={isExecuting || !query.trim()}
              >
                Explain
              </Button>
              <Button
                variant="secondary"
                onClick={() => setQuery(formatSQL(query, databaseType))}
                disabled={isExecuting || !query.trim()}
              >
                Format
              </Button>
              <Button variant="secondary" onClick={handleClear} disabled={isExecuting}>
                Clear
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsSaveDialogOpen(true)}
                disabled={!query.trim()}
              >
                Save
              </Button>
              <Button
                variant={showSavedQueries ? 'primary' : 'ghost'}
                onClick={() => { setShowSavedQueries(!showSavedQueries); setShowHistory(false); }}
              >
                Saved
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowTemplates(true)}
              >
                Templates
              </Button>
              <Button
                variant={showHistory ? 'primary' : 'ghost'}
                onClick={() => { setShowHistory(!showHistory); setShowSavedQueries(false); }}
              >
                History
              </Button>
            </div>
            {executionTime !== null && (
              <span className="text-sm text-muted font-mono">
                {executionTime}ms
              </span>
            )}
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
          {showSavedQueries && (
            <SavedQueriesPanel
              queries={savedQueries}
              onSelect={(sql) => {
                setQuery(sql);
                setShowSavedQueries(false);
              }}
              onDelete={deleteSavedQuery}
              onClear={clearSavedQueries}
            />
          )}
        </div>
      </Card>
      <SaveQueryDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        onSave={(name, tags) => saveQuery(name, query, tags)}
        query={query}
      />
      <TemplateBrowser
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onInsert={(sql) => setQuery(sql)}
        dialect={databaseType || 'postgresql'}
      />
      <TemplateEditor
        isOpen={isTemplateEditorOpen}
        onClose={() => setIsTemplateEditorOpen(false)}
        onSave={addTemplate}
      />

      {hasResults && (
        <div>
          {results.length > 0 && explainPlan && (
            <div className="flex gap-1 mb-4">
              <button
                onClick={() => setViewMode('results')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'results'
                    ? 'bg-accent/10 text-accent'
                    : 'text-secondary hover:text-primary hover:bg-bg-secondary'
                }`}
              >
                Results
              </button>
              <button
                onClick={() => setViewMode('explain')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'explain'
                    ? 'bg-accent/10 text-accent'
                    : 'text-secondary hover:text-primary hover:bg-bg-secondary'
                }`}
              >
                Explain plan
              </button>
            </div>
          )}

          {viewMode === 'results' && results.length > 0 && !showDiff && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">
                  {results.length} {results.length === 1 ? 'row' : 'rows'} returned
                </span>
                <div className="flex items-center gap-2">
                  {pinnedResult && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDiff(true)}
                    >
                      Compare with Pinned
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPinnedResult({
                        id: `pin_${Date.now()}`,
                        query,
                        columns,
                        data: results,
                        executionTime: executionTime || 0,
                        pinnedAt: Date.now(),
                      });
                      setShowDiff(false);
                    }}
                  >
                    {pinnedResult ? 'Re-pin' : 'Pin Result'}
                  </Button>
                </div>
              </div>
              {pinnedResult && (
                <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-bg-secondary rounded-md text-xs text-muted">
                  <span>Pinned: {pinnedResult.query.slice(0, 50)}{pinnedResult.query.length > 50 ? '...' : ''}</span>
                  <span>({pinnedResult.data.length} rows)</span>
                  <button
                    onClick={() => { setPinnedResult(null); setShowDiff(false); }}
                    className="ml-auto text-danger hover:text-danger/80"
                  >
                    Unpin
                  </button>
                </div>
              )}
              <DataTable columns={columns} data={results} isLoading={false} columnTypes={resultColumnTypes} />
            </>
          )}

          {viewMode === 'results' && showDiff && pinnedResult && results.length > 0 && (
            <QueryDiffView
              pinned={pinnedResult}
              current={{
                id: `current_${Date.now()}`,
                query,
                columns,
                data: results,
                executionTime: executionTime || 0,
                pinnedAt: Date.now(),
              }}
              onClose={() => setShowDiff(false)}
            />
          )}

          {viewMode === 'explain' && explainPlan && (
            <ExplainPlan plan={explainPlan} />
          )}
        </div>
      )}

      {results.length === 0 && !explainPlan && !error && executionTime !== null && (
        <div className="text-center py-6 text-sm text-muted">
          Query executed successfully. No rows returned.
        </div>
      )}
    </div>
  );
};
