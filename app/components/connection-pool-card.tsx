"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { usePolling } from "../hooks/use-polling";

interface HealthData {
  healthy: boolean;
  latency: number | null;
  activeConnections: number;
  idleConnections: number;
  failureCount: number;
  lastCheck: number | null;
}

interface ConnectionPoolCardProps {
  enabled: boolean;
}

const MAX_POOL_SIZE = 20;

export const ConnectionPoolCard: React.FC<ConnectionPoolCardProps> = ({ enabled }) => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isLoading, refresh } = usePolling(
    async () => {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (!data.healthy && data.error) {
        setError(data.error);
        setHealth(null);
        return;
      }
      setError(null);
      setHealth(data);
    },
    10000,
    enabled
  );

  const total = health
    ? health.activeConnections + health.idleConnections
    : 0;
  const activePercent = total > 0
    ? Math.round((health!.activeConnections / MAX_POOL_SIZE) * 100)
    : 0;
  const idlePercent = total > 0
    ? Math.round((health!.idleConnections / MAX_POOL_SIZE) * 100)
    : 0;

  return (
    <Card title="Connection pool">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                !health || !health.healthy
                  ? "danger"
                  : health.activeConnections > 15
                  ? "warning"
                  : "success"
              }
            >
              {health?.healthy ? "Healthy" : "Unhealthy"}
            </Badge>
            {health?.latency !== null && health?.latency !== undefined && (
              <span className="text-xs text-muted font-mono">
                {health.latency}ms
              </span>
            )}
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

        {health && (
          <>
            {/* Pool bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-secondary">
                <span>Pool utilization</span>
                <span className="font-mono">{total} / {MAX_POOL_SIZE}</span>
              </div>
              <div className="w-full bg-bg-secondary rounded-full h-3 flex overflow-hidden">
                <div
                  className="bg-accent h-3 transition-all duration-300"
                  style={{ width: `${activePercent}%` }}
                  title={`Active: ${health.activeConnections}`}
                />
                <div
                  className="bg-accent/30 h-3 transition-all duration-300"
                  style={{ width: `${idlePercent}%` }}
                  title={`Idle: ${health.idleConnections}`}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
                  <span>Active ({health.activeConnections})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-accent/30" />
                  <span>Idle ({health.idleConnections})</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border rounded-md p-2.5">
                <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">
                  Latency
                </div>
                <div className="text-lg font-semibold font-mono text-primary">
                  {health.latency !== null ? `${health.latency}ms` : "—"}
                </div>
              </div>
              <div className="border border-border rounded-md p-2.5">
                <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">
                  Failures
                </div>
                <div
                  className={`text-lg font-semibold font-mono ${
                    health.failureCount > 0 ? "text-danger" : "text-primary"
                  }`}
                >
                  {health.failureCount}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="text-[10px] text-muted text-right">
          Polling every 10s
        </div>
      </div>
    </Card>
  );
};
