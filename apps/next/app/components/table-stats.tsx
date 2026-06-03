'use client';

import React from 'react';

export interface TableStatsData {
  total_size: string;
  table_size: string;
  index_size: string;
  estimated_rows: number;
  seq_scan: number;
  idx_scan: number;
  live_rows: number;
  dead_rows: number;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  last_autoanalyze: string | null;
}

interface TableStatsProps {
  stats: TableStatsData | null;
  isLoading?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
}

export const TableStats: React.FC<TableStatsProps> = ({ stats, isLoading }) => {
  if (isLoading || !stats) return null;

  const items = [
    { label: 'Size', value: stats.total_size },
    { label: 'Table', value: stats.table_size },
    { label: 'Indexes', value: stats.index_size },
    { label: 'Rows', value: stats.estimated_rows?.toLocaleString() || '0' },
    { label: 'Seq scans', value: stats.seq_scan?.toLocaleString() || '0' },
    { label: 'Idx scans', value: stats.idx_scan?.toLocaleString() || '0' },
    { label: 'Dead rows', value: stats.dead_rows?.toLocaleString() || '0' },
    { label: 'Vacuum', value: formatDate(stats.last_vacuum || stats.last_autovacuum) },
  ];

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2 mb-4 bg-bg-secondary rounded-lg">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <span className="text-muted">
            {item.label}
          </span>
          <span className="font-medium text-primary font-mono">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
};
