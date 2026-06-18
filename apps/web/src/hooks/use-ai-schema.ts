import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/db';
import {
  formatTypedSchema,
  formatSchemaForPrompt,
  formatCompactSchema,
  COMPACT_TABLE_THRESHOLD,
  COMPACT_COLUMN_THRESHOLD,
} from '@/lib/ai';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';

/**
 * Formatted schema text used to ground the AI (NL→SQL and AI mode).
 *
 * Prefers the typed overview (column types + PK/FK) fetched once per
 * connection/schema and cached; falls back to the already-loaded
 * names-only `schemaMap` while that's in flight so the AI is never
 * sent an empty schema.
 *
 * `allowCompact` (AI mode only — it has the describe_table tool): for large
 * schemas, send just the table list and let the agent drill in on demand,
 * instead of stuffing every column into every prompt. Single-shot callers
 * (the Generate bar) leave it off and always get the full typed schema.
 */
export function useAiSchemaText(opts?: { allowCompact?: boolean }): string {
  const allowCompact = opts?.allowCompact ?? false;
  const { isConnected, databaseName } = useConnection();
  const { selectedSchema, schemaMap, tables } = useDashboard();

  const { data } = useQuery({
    queryKey: ['aiSchemaOverview', databaseName, selectedSchema],
    queryFn: () => db.schemaOverview(selectedSchema),
    enabled: isConnected,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (data && data.length > 0) {
      const totalColumns = data.reduce((n, t) => n + t.columns.length, 0);
      const isLarge =
        data.length > COMPACT_TABLE_THRESHOLD || totalColumns > COMPACT_COLUMN_THRESHOLD;
      return allowCompact && isLarge
        ? formatCompactSchema(selectedSchema, data)
        : formatTypedSchema(selectedSchema, data);
    }
    const flat: Record<string, string[]> =
      Object.keys(schemaMap).length > 0
        ? schemaMap
        : tables.reduce<Record<string, string[]>>((acc, t) => {
            acc[t] = [];
            return acc;
          }, {});
    return formatSchemaForPrompt(selectedSchema, flat);
  }, [data, selectedSchema, schemaMap, tables, allowCompact]);
}
