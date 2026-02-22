"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { usePolling } from "../hooks/use-polling";

interface ActiveQuery {
  pid: number;
  username: string;
  database: string;
  state: string;
  query: string;
  duration_ms: number;
  wait_event_type?: string;
  wait_event?: string;
}

interface ActiveQueriesCardProps {
  enabled: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const ActiveQueriesCard: React.FC<ActiveQueriesCardProps> = ({ enabled }) => {
  const [queries, setQueries] = useState<ActiveQuery[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { isLoading, refresh, lastUpdated } = usePolling(
    async () => {
      const res = await fetch("/api/performance/active-queries");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setError(null);
      setQueries(data.queries || []);
    },
    5000,
    enabled
  );

  return (
    <Card title="Active queries">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={queries.length > 0 ? "warning" : "success"}>
              {queries.length} active
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

        {error && (
          <div className="text-xs text-danger">{error}</div>
        )}

        {queries.length === 0 && !error && (
          <div className="text-sm text-muted text-center py-4">
            No active queries
          </div>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {queries.map((q, i) => (
            <div
              key={`${q.pid}-${i}`}
              className="border border-border rounded-md p-2.5 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted">PID {q.pid}</span>
                  <Badge
                    variant={
                      q.state === "active"
                        ? "success"
                        : q.state === "idle in transaction"
                        ? "warning"
                        : "info"
                    }
                  >
                    {q.state}
                  </Badge>
                </div>
                <span
                  className={`font-mono ${
                    q.duration_ms > 10000
                      ? "text-danger"
                      : q.duration_ms > 3000
                      ? "text-warning"
                      : "text-muted"
                  }`}
                >
                  {formatDuration(q.duration_ms)}
                </span>
              </div>
              <div className="font-mono text-primary break-all line-clamp-2">
                {q.query}
              </div>
              <div className="flex items-center gap-3 text-muted">
                <span>{q.username}</span>
                <span>{q.database}</span>
                {q.wait_event && (
                  <span>
                    waiting: {q.wait_event_type}/{q.wait_event}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {lastUpdated && (
          <div className="text-[10px] text-muted text-right">
            Polling every 5s
          </div>
        )}
      </div>
    </Card>
  );
};
