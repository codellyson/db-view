'use client';

import { useEffect, useRef } from 'react';
import { useDashboard } from '../contexts/dashboard-context';
import { useTableListPrefs } from './use-table-list-prefs';
import { useConnection } from '../contexts/connection-context';
import type { Filter } from '@/lib/filters';

/**
 * Two-way sync between the active dashboard state and the URL query string.
 *
 * - On initial mount, read params and seed dashboard state (open the table,
 *   apply filters / sort / page).
 * - After mount, push state changes back to the URL via
 *   `history.replaceState` so paste-share works without page reloads.
 * - Listens to `popstate` (back/forward) and re-reads the URL.
 *
 * Only the active table view is synced. Query/editor tabs fall back to the
 * table-only URL form (other state lives in localStorage already).
 */
export function useUrlState() {
  const dash = useDashboard();
  const { databaseName } = useConnection();
  const prefs = useTableListPrefs(databaseName);
  const initializedRef = useRef(false);

  // Hydrate dashboard from URL once after connection is up.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!databaseName || initializedRef.current) return;
    initializedRef.current = true;
    applyUrl(window.location.search);
    // We deliberately don't include the dashboard / prefs callbacks in deps —
    // we only want to hydrate once per connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseName]);

  // Listen for back/forward navigation and re-apply.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => applyUrl(window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push state to URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!initializedRef.current) return;
    if (dash.isQueryTab || dash.isEditorTab) return;
    if (!dash.selectedTable) return;
    const params = new URLSearchParams();
    params.set('schema', dash.selectedSchema);
    params.set('table', dash.selectedTable);
    if (dash.sortColumn && dash.sortDirection) {
      params.set('sort', dash.sortColumn);
      params.set('dir', dash.sortDirection);
    }
    if (dash.tableFilters.length > 0) {
      params.set('filters', JSON.stringify(dash.tableFilters));
    }
    if (dash.currentPage > 1) {
      params.set('page', String(dash.currentPage));
    }
    const next = `${window.location.pathname}?${params.toString()}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', next);
    }
  }, [
    dash.selectedSchema,
    dash.selectedTable,
    dash.sortColumn,
    dash.sortDirection,
    dash.tableFilters,
    dash.currentPage,
    dash.isQueryTab,
    dash.isEditorTab,
  ]);

  function applyUrl(search: string) {
    const params = new URLSearchParams(search);
    const table = params.get('table');
    const schema = params.get('schema');
    const sort = params.get('sort');
    const dir = params.get('dir');
    const filtersRaw = params.get('filters');
    const page = params.get('page');

    if (schema && schema !== dash.selectedSchema) {
      dash.handleSchemaChange(schema);
    }
    if (table) {
      prefs.recordOpen(table);
      dash.handleTableSelect(table);
    }
    if (sort && (dir === 'asc' || dir === 'desc')) {
      dash.setSortColumn(sort);
      dash.setSortDirection(dir);
    }
    if (filtersRaw) {
      try {
        const parsed = JSON.parse(filtersRaw) as Filter[];
        if (Array.isArray(parsed)) dash.setTableFilters(parsed);
      } catch {
        // ignore
      }
    }
    if (page) {
      const n = parseInt(page, 10);
      if (!isNaN(n) && n >= 1) dash.setCurrentPage(n);
    }
  }
}
