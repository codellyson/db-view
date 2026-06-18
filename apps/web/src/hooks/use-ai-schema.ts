import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { formatTypedSchema, formatSchemaForPrompt } from '@/lib/ai';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';

/**
 * Formatted schema text used to ground the AI (NL→SQL and AI mode).
 *
 * Prefers the typed overview (column types + PK/FK) fetched once per
 * connection/schema and cached; falls back to the already-loaded
 * names-only `schemaMap` while that's in flight so the AI is never
 * sent an empty schema.
 */
export function useAiSchemaText(): string {
  const { isConnected, databaseName } = useConnection();
  const { selectedSchema, schemaMap, tables } = useDashboard();

  const { data } = useQuery({
    queryKey: ['aiSchemaOverview', databaseName, selectedSchema],
    queryFn: () => db.schemaOverview(selectedSchema),
    enabled: isConnected,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (data && data.length > 0) return formatTypedSchema(selectedSchema, data);
    const flat: Record<string, string[]> =
      Object.keys(schemaMap).length > 0
        ? schemaMap
        : tables.reduce<Record<string, string[]>>((acc, t) => {
            acc[t] = [];
            return acc;
          }, {});
    return formatSchemaForPrompt(selectedSchema, flat);
  }, [data, selectedSchema, schemaMap, tables]);
}
