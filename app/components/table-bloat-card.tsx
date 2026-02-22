"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { usePolling } from "../hooks/use-polling";

interface TableBloat {
  table_name: string;
  live_rows: number;
  dead_rows: number;
  bloat_ratio: number;
  total_size: string;
  table_size: string;
  index_size: string;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  last_autoanalyze: string | null;
}

interface TableBloatCardProps {
  enabled: boolean;
  schema: string;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.round(diffMs / 3600000)}h ago`;
  return `${Math.round(diffMs / 86400000)}d ago`;
}

export const TableBloatCard: React.FC<TableBloatCardProps> = ({
  enabled,
  schema,
}) => {
  const [tables, setTables] = useState<TableBloat[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { isLoading, refresh } = usePolling(
    async () => {
      const res = await fetch(
        `/api/performance/table-bloat?schema=${encodeURIComponent(schema)}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setError(null);
      setTables(data.tables || []);
    },
    30000,
    enabled
  );

  return (
    <Card title="Table bloat">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="info">{tables.length} tables</Badge>
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

        {tables.length === 0 && !error && (
          <div className="text-sm text-muted text-center py-4">
            No table data available
          </div>
        )}

        {tables.length > 0 && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg">
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 pr-3 font-medium">Table</th>
                  <th className="pb-2 pr-3 font-medium text-right">Live</th>
                  <th className="pb-2 pr-3 font-medium text-right">Dead</th>
                  <th className="pb-2 pr-3 font-medium text-right">Bloat</th>
                  <th className="pb-2 pr-3 font-medium text-right">Size</th>
                  <th className="pb-2 font-medium text-right">Vacuum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tables.map((t) => (
                  <tr
                    key={t.table_name}
                    className="hover:bg-bg-secondary transition-colors"
                  >
                    <td className="py-2 pr-3 font-mono text-primary whitespace-nowrap">
                      {t.table_name}
                    </td>
                    <td className="py-2 pr-3 text-right text-secondary tabular-nums">
                      {Number(t.live_rows).toLocaleString()}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums ${
                        Number(t.dead_rows) > 1000 ? "text-danger" : "text-secondary"
                      }`}
                    >
                      {Number(t.dead_rows).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          Number(t.bloat_ratio) > 20
                            ? "bg-danger/10 text-danger"
                            : Number(t.bloat_ratio) > 5
                            ? "bg-warning/10 text-warning"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {t.bloat_ratio}%
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-secondary whitespace-nowrap">
                      {t.total_size}
                    </td>
                    <td className="py-2 text-right text-muted whitespace-nowrap">
                      {formatTimestamp(t.last_autovacuum || t.last_vacuum)}
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
