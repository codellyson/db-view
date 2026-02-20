'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DataTable } from './data-table';
import { ErrorState } from './error-state';
import { SqlEditor } from './sql-editor';
import { ExplainPlan } from './explain-plan';
import { useQueryHistory } from '../hooks/use-query-history';
import { QueryHistory } from './query-history';

interface QueryEditorProps {}

export const QueryEditor: React.FC<QueryEditorProps> = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [explainPlan, setExplainPlan] = useState<any[] | null>(null);
  const [viewMode, setViewMode] = useState<'results' | 'explain'>('results');
  const { history, addQuery, favoriteQuery, deleteQuery, clearHistory } = useQueryHistory();

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
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Query execution failed');
      }

      if (data.rows && data.rows.length > 0) {
        setColumns(Object.keys(data.rows[0]));
      } else {
        setColumns([]);
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
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Explain failed');
      }

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
    <div className="space-y-8">
      <Card title="SQL QUERY">
        <div className="space-y-4">
          <SqlEditor
            value={query}
            onChange={setQuery}
            onExecute={!isExecuting && query.trim() ? handleExecute : undefined}
            disabled={isExecuting}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                onClick={handleExecute}
                isLoading={isExecuting && viewMode === 'results'}
                disabled={isExecuting || !query.trim()}
              >
                EXECUTE
              </Button>
              <Button
                variant="secondary"
                onClick={handleExplain}
                isLoading={isExecuting && viewMode === 'explain'}
                disabled={isExecuting || !query.trim()}
              >
                EXPLAIN
              </Button>
              <Button variant="secondary" onClick={handleClear} disabled={isExecuting}>
                CLEAR
              </Button>
              <Button
                variant={showHistory ? 'primary' : 'ghost'}
                onClick={() => setShowHistory(!showHistory)}
              >
                HISTORY
              </Button>
            </div>
            {executionTime !== null && (
              <span className="text-sm font-bold uppercase text-black dark:text-white font-mono">
                {executionTime}MS
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
        </div>
      </Card>

      {hasResults && (
        <Card>
          {results.length > 0 && explainPlan && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setViewMode('results')}
                className={`px-4 py-2 text-sm font-bold uppercase font-mono border-2 border-black dark:border-white ${
                  viewMode === 'results'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-white text-black dark:bg-black dark:text-white'
                }`}
              >
                RESULTS
              </button>
              <button
                onClick={() => setViewMode('explain')}
                className={`px-4 py-2 text-sm font-bold uppercase font-mono border-2 border-black dark:border-white ${
                  viewMode === 'explain'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-white text-black dark:bg-black dark:text-white'
                }`}
              >
                EXPLAIN PLAN
              </button>
            </div>
          )}

          {viewMode === 'results' && results.length > 0 && (
            <>
              <div className="mb-4 text-sm font-bold uppercase text-black dark:text-white font-mono">
                {results.length} {results.length === 1 ? 'ROW' : 'ROWS'} RETURNED
              </div>
              <DataTable columns={columns} data={results} isLoading={false} />
            </>
          )}

          {viewMode === 'explain' && explainPlan && (
            <ExplainPlan plan={explainPlan} />
          )}
        </Card>
      )}

      {results.length === 0 && !explainPlan && !error && executionTime !== null && (
        <Card>
          <div className="text-center py-8 text-black dark:text-white font-bold uppercase font-mono">
            QUERY EXECUTED SUCCESSFULLY. NO ROWS RETURNED.
          </div>
        </Card>
      )}
    </div>
  );
};
