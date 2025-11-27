'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DataTable } from './data-table';
import { Spinner } from './ui/spinner';

interface QueryEditorProps {}

export const QueryEditor: React.FC<QueryEditorProps> = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResults([]);
    setColumns([]);
    setExecutionTime(null);

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
      setResults(data.rows || []);
      setExecutionTime(data.executionTime || null);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
      setResults([]);
      setColumns([]);
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
  };

  return (
    <div className="space-y-8">
      <Card title="SQL QUERY">
        <div className="space-y-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT * FROM users LIMIT 10;"
            className="w-full h-48 px-4 py-3 font-mono text-sm border-2 border-black rounded-none focus:outline-none focus:shadow-[0_0_0_2px_black] bg-white text-black resize-none"
            disabled={isExecuting}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleExecute}
                isLoading={isExecuting}
                disabled={isExecuting || !query.trim()}
              >
                EXECUTE QUERY
              </Button>
              <Button variant="secondary" onClick={handleClear} disabled={isExecuting}>
                CLEAR
              </Button>
            </div>
            {executionTime !== null && (
              <span className="text-sm font-bold uppercase text-black font-mono">
                EXECUTED IN {executionTime}MS
              </span>
            )}
          </div>
          {error && (
            <div className="p-4 bg-red-500 border-2 border-black text-white font-bold uppercase">
              {error}
            </div>
          )}
        </div>
      </Card>

      {results.length > 0 && (
        <Card title="RESULTS">
          <div className="mb-4 text-sm font-bold uppercase text-black font-mono">
            {results.length} {results.length === 1 ? 'ROW' : 'ROWS'} RETURNED
          </div>
          <DataTable columns={columns} data={results} isLoading={false} />
        </Card>
      )}

      {results.length === 0 && !error && executionTime !== null && (
        <Card>
          <div className="text-center py-8 text-black font-bold uppercase font-mono">
            QUERY EXECUTED SUCCESSFULLY. NO ROWS RETURNED.
          </div>
        </Card>
      )}
    </div>
  );
};

