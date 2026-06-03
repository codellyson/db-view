
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import {
  generateCSVContent,
  generateJSONContent,
  generateNDJSONContent,
  generateSQLContent,
  generateXLSXBlob,
  saveBlob,
} from '@/lib/export-utils';
import type { Filter } from '@/lib/filters';
import { api } from '@/lib/api';
import { useToast } from '../contexts/toast-context';

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'ndjson' | 'sql' | 'xlsx';
type Scope = 'current' | 'all';

type DatabaseType = 'postgresql' | 'mysql' | 'sqlite';

/**
 * Where the exported rows came from. `table` mode supports both "current view"
 * and "all rows" (re-fetched paginated, honoring filters/sort). `query` mode is
 * a one-shot export of whatever rows are currently in memory from a SQL editor
 * result — there's nothing to paginate against, so the scope picker is hidden
 * and SQL INSERT format is suppressed (no canonical target table to insert into).
 */
export type ExportSource =
  | {
      kind: 'table';
      schema: string;
      table: string;
      databaseType: DatabaseType;
      filters: Filter[];
      sortColumn?: string | null;
      sortDirection?: 'asc' | 'desc' | null;
      /** Total row count for the underlying table view; used to label "All rows". */
      currentTotal: number;
    }
  | {
      kind: 'query';
      databaseType: DatabaseType;
    };

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: ExportSource;
  /** Current rows the user is looking at (filtered/sorted view, or query result). */
  currentColumns: string[];
  currentRows: any[];
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; ext: string; mime: string }[] = [
  { value: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv;charset=utf-8;' },
  { value: 'tsv', label: 'TSV', ext: 'tsv', mime: 'text/tab-separated-values;charset=utf-8;' },
  { value: 'json', label: 'JSON', ext: 'json', mime: 'application/json;charset=utf-8;' },
  { value: 'ndjson', label: 'NDJSON', ext: 'ndjson', mime: 'application/x-ndjson;charset=utf-8;' },
  { value: 'sql', label: 'SQL INSERT', ext: 'sql', mime: 'text/sql;charset=utf-8;' },
  {
    value: 'xlsx',
    label: 'Excel (.xlsx)',
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
];

interface SavedDefaults {
  format: ExportFormat;
  scope: Scope;
  csvHeaders: boolean;
  jsonPretty: boolean;
  sqlQualified: boolean;
}

const DEFAULTS_KEY = 'dbview-export-defaults';

function loadDefaults(): Partial<SavedDefaults> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDefaults(d: SavedDefaults) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d));
  } catch {
    // ignore
  }
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  source,
  currentColumns,
  currentRows,
}) => {
  const { addToast } = useToast();
  const defaults = useMemo(() => loadDefaults(), []);
  // Query mode never has a paginated "all rows" path — pin the scope to current.
  const [scope, setScope] = useState<Scope>(
    source.kind === 'query' ? 'current' : defaults.scope ?? 'current',
  );
  const [format, setFormat] = useState<ExportFormat>(() => {
    const saved = defaults.format ?? 'csv';
    return source.kind === 'query' && saved === 'sql' ? 'csv' : saved;
  });
  const [csvHeaders, setCsvHeaders] = useState(defaults.csvHeaders ?? true);
  const [jsonPretty, setJsonPretty] = useState(defaults.jsonPretty ?? true);
  const [sqlQualified, setSqlQualified] = useState(defaults.sqlQualified ?? false);
  const [rememberDefaults, setRememberDefaults] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Reset progress / busy when reopened.
  useEffect(() => {
    if (isOpen) {
      setProgress(null);
      setBusy(false);
    }
  }, [isOpen]);

  const formatOptions = useMemo(
    () =>
      source.kind === 'query'
        ? FORMAT_OPTIONS.filter((f) => f.value !== 'sql')
        : FORMAT_OPTIONS,
    [source.kind],
  );
  const fmtMeta = formatOptions.find((f) => f.value === format) ?? formatOptions[0];
  const showCsvOpts = format === 'csv' || format === 'tsv';
  const showJsonOpts = format === 'json';
  const showSqlOpts = format === 'sql' && source.kind === 'table';

  const fetchAllRows = async (): Promise<{ columns: string[]; rows: any[] }> => {
    if (source.kind !== 'table') return { columns: currentColumns, rows: currentRows };
    const { schema, table, filters, sortColumn, sortDirection, currentTotal } = source;
    const PAGE = 1000;
    let offset = 0;
    const accum: any[] = [];
    let columns: string[] = [];
    setProgress({ done: 0, total: currentTotal || 0 });
    for (;;) {
      let url = `/api/table/${encodeURIComponent(table)}?limit=${PAGE}&offset=${offset}&schema=${encodeURIComponent(schema)}`;
      if (sortColumn && sortDirection) {
        url += `&sortColumn=${encodeURIComponent(sortColumn)}&sortDirection=${sortDirection}`;
      }
      if (filters.length > 0) {
        url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
      }
      const data = await api.get(url);
      const pageRows: any[] = data.rows || [];
      if (columns.length === 0 && pageRows.length > 0) columns = Object.keys(pageRows[0]);
      accum.push(...pageRows);
      setProgress({ done: accum.length, total: data.total ?? accum.length });
      if (pageRows.length < PAGE) break;
      offset += PAGE;
    }
    return { columns: columns.length ? columns : currentColumns, rows: accum };
  };

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { columns, rows } = scope === 'all' ? await fetchAllRows() : { columns: currentColumns, rows: currentRows };
      const stamp = new Date().toISOString().split('T')[0];
      const baseName = source.kind === 'table' ? source.table : 'query_result';
      const filename = `${baseName}_${stamp}.${fmtMeta.ext}`;

      if (format === 'xlsx') {
        const blob = await generateXLSXBlob(columns, rows);
        await saveBlob(blob, filename, fmtMeta.mime);
      } else if (format === 'csv' || format === 'tsv') {
        const content = generateCSVContent(columns, rows, {
          separator: format === 'csv' ? ',' : '\t',
          includeHeaders: csvHeaders,
        });
        await saveBlob(content, filename, fmtMeta.mime);
      } else if (format === 'json') {
        const content = generateJSONContent(rows, jsonPretty);
        await saveBlob(content, filename, fmtMeta.mime);
      } else if (format === 'ndjson') {
        const content = generateNDJSONContent(rows);
        await saveBlob(content, filename, fmtMeta.mime);
      } else if (format === 'sql' && source.kind === 'table') {
        const content = generateSQLContent(columns, rows, source.table, {
          dialect: source.databaseType,
          schema: sqlQualified ? source.schema : undefined,
        });
        await saveBlob(content, filename, fmtMeta.mime);
      }

      if (rememberDefaults) {
        saveDefaults({ format, scope, csvHeaders, jsonPretty, sqlQualified });
      }
      addToast(`Exported ${rows.length} rows as ${fmtMeta.label}`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Export failed', 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export" preventClose={busy}>
      <div className="space-y-4">
        {source.kind === 'table' ? (
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-secondary mb-1.5">Scope</legend>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="current"
                checked={scope === 'current'}
                onChange={() => setScope('current')}
              />
              <span>
                Current view{source.filters.length > 0 ? ' (filtered + sorted)' : source.sortColumn ? ' (sorted)' : ''}
                <span className="text-muted ml-2">{currentRows.length} rows</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              <span>
                All rows in this table
                <span className="text-muted ml-2">
                  {source.filters.length > 0 ? `${source.currentTotal} matching` : `${source.currentTotal} rows`}
                </span>
              </span>
            </label>
          </fieldset>
        ) : (
          <div className="text-sm text-secondary">
            Exporting <span className="text-primary font-medium">{currentRows.length}</span> rows from the current query result.
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {formatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {(showCsvOpts || showJsonOpts || showSqlOpts) && (
          <div className="space-y-1.5">
            {showCsvOpts && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={csvHeaders}
                  onChange={(e) => setCsvHeaders(e.target.checked)}
                />
                Include headers
              </label>
            )}
            {showJsonOpts && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={jsonPretty}
                  onChange={(e) => setJsonPretty(e.target.checked)}
                />
                Pretty-print
              </label>
            )}
            {showSqlOpts && source.kind === 'table' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={sqlQualified}
                  onChange={(e) => setSqlQualified(e.target.checked)}
                />
                Use schema-qualified table name (<span className="font-mono text-xs">{source.schema}.{source.table}</span>)
              </label>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer pt-2 border-t border-border">
          <input
            type="checkbox"
            checked={rememberDefaults}
            onChange={(e) => setRememberDefaults(e.target.checked)}
          />
          Remember my choice
        </label>

        {progress && progress.total > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Fetching rows…</span>
              <span className="font-mono">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-bg-secondary rounded overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleExport} isLoading={busy} disabled={busy}>
            Export
          </Button>
        </div>
      </div>
    </Modal>
  );
};
