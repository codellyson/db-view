"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { usePolling } from "../hooks/use-polling";

interface SlowQuery {
  query: string;
  calls: number;
  total_time_ms: number;
  mean_time_ms: number;
  min_time_ms: number;
  max_time_ms: number;
  rows: number;
}

interface SlowQueriesCardProps {
  enabled: boolean;
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const SlowQueriesCard: React.FC<SlowQueriesCardProps> = ({ enabled }) => {
  const [queries, setQueries] = useState<SlowQuery[]>([]);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isLoading, refresh } = usePolling(
    async () => {
      const res = await fetch("/api/performance/slow-queries");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setError(null);
      setAvailable(data.available);
      setMessage(data.message || null);
      setQueries(data.queries || []);
    },
    30000,
    enabled
  );

  return (
    <Card title="Slow queries">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={available ? "info" : "warning"}>
              {available ? `Top ${queries.length}` : "Unavailable"}
            </Badge>
            {isLoading && (
              <span className="text-xs text-muted">refreshing...</span>
            )}
          </div>
          <button
            onClick={refresh}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Refresh
          </button>
        </div>

        {error && <div className="text-xs text-danger">{error}</div>}

        {!available && message && (
          <div className="text-sm text-muted text-center py-4 space-y-1">
            <p>{message}</p>
            <p className="text-xs">
              Enable the extension for slow query tracking.
            </p>
          </div>
        )}

        {available && queries.length === 0 && !error && (
          <div className="text-sm text-muted text-center py-4">
            No slow queries recorded
          </div>
        )}

        {available && queries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 pr-3 font-medium">Query</th>
                  <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">
                    Calls
                  </th>
                  <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">
                    Total
                  </th>
                  <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">
                    Mean
                  </th>
                  <th className="pb-2 font-medium text-right whitespace-nowrap">
                    Rows
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queries.map((q, i) => (
                  <tr key={i} className="hover:bg-bg-secondary transition-colors">
                    <td className="py-2 pr-3 font-mono text-primary max-w-[300px] truncate">
                      {q.query}
                    </td>
                    <td className="py-2 pr-3 text-right text-secondary tabular-nums">
                      {q.calls.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right text-secondary tabular-nums whitespace-nowrap">
                      {formatMs(q.total_time_ms)}
                    </td>
                    <td className="py-2 pr-3 text-right text-secondary tabular-nums whitespace-nowrap">
                      {formatMs(q.mean_time_ms)}
                    </td>
                    <td className="py-2 text-right text-secondary tabular-nums">
                      {q.rows.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[10px] text-muted text-right">
          Polling every 30s
        </div>
      </div>
    </Card>
  );
};
