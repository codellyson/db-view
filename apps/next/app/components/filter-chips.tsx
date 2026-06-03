'use client';

import React from 'react';
import { describeFilters, type Filter, type FilterOperator } from '@/lib/filters';

interface FilterChipsProps {
  filters: Filter[];
  onRemove: (column: string) => void;
  onClearAll: () => void;
  onEdit: (column: string) => void;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '≠',
  contains: 'contains',
  starts_with: 'starts with',
  is_null: 'is NULL',
  is_not_null: 'is not NULL',
  between: 'between',
  in: 'in',
};

function chipText(f: Filter): string {
  const op = OPERATOR_LABELS[f.operator];
  if (f.operator === 'is_null' || f.operator === 'is_not_null') return op;
  if (f.operator === 'between') {
    const vs = f.values ?? [];
    return `${op} ${vs[0]} and ${vs[1]}`;
  }
  if (f.operator === 'in') {
    const vs = (f.values ?? []).slice(0, 3).join(', ');
    const more = (f.values?.length ?? 0) > 3 ? `, +${(f.values!.length - 3)}` : '';
    return `${op} (${vs}${more})`;
  }
  return `${op} ${f.value === null || f.value === undefined ? 'NULL' : String(f.value)}`;
}

export const FilterChips: React.FC<FilterChipsProps> = ({ filters, onRemove, onClearAll, onEdit }) => {
  if (filters.length === 0) return null;
  const sql = describeFilters(filters);

  return (
    <div className="space-y-1.5 mb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f.column}
            onClick={() => onEdit(f.column)}
            className="group inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs bg-warning/15 hover:bg-warning/25 border border-warning/30 rounded transition-colors"
            title="Edit filter"
          >
            <span className="font-mono text-primary">{f.column}</span>
            <span className="text-muted">{chipText(f)}</span>
            <span
              role="button"
              aria-label={`Remove filter on ${f.column}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(f.column);
              }}
              className="ml-0.5 px-1 py-0.5 text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
            >
              ×
            </span>
          </button>
        ))}
        {filters.length > 1 && (
          <button
            onClick={onClearAll}
            className="text-[11px] text-muted hover:text-primary px-1.5 py-0.5 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="text-[11px] font-mono text-muted truncate" title={sql}>
        {sql}
      </div>
    </div>
  );
};
