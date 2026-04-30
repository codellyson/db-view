'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import {
  generateCSVContent,
  generateJSONContent,
  generateNDJSONContent,
  generateSQLContent,
  generateXLSXBlob,
  downloadBlob,
} from '@/lib/export-utils';
import type { Filter } from '@/lib/filters';
import { api } from '@/lib/api';
import { useToast } from '../contexts/toast-context';

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'ndjson' | 'sql' | 'xlsx';
type Scope = 'current' | 'all';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Active table info — drives label, fetch URL, and SQL export naming. */
  schema: string;
  table: string;
  databaseType: 'postgresql' | 'mysql' | 'sqlite';
  /** Current view (filtered + sorted as the user is looking at it). */
  currentColumns: string[];
  currentRows: any[];
  /** Total row count for the current view; used to label the radio option. */
  currentTotal: number;
  /** Filters in effect for the current view; sent when re-fetching All rows. */
  filters: Filter[];
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
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
  schema,
  table,
  databaseType,
  currentColumns,
  currentRows,
  currentTotal,
  filters,
  sortColumn,
  sortDirection,
}) => {
  const { addToast } = useToast();
  const defaults = useMemo(() => loadDefaults(), []);
  const [scope, setScope] = useState<Scope>(defaults.scope ?? 'current');
  const [format, setFormat] = useState<ExportFormat>(defaults.format ?? 'csv');
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

  const fmtMeta = FORMAT_OPTIONS.find((f) => f.value === format)!;
  const showCsvOpts = format === 'csv' || format === 'tsv';
  const showJsonOpts = format === 'json';
  const showSqlOpts = format === 'sql';

  const fetchAllRows = async (): Promise<{ columns: string[]; rows: any[] }> => {
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
      const filename = `${table}_${stamp}.${fmtMeta.ext}`;

      if (format === 'xlsx') {
        const blob = await generateXLSXBlob(columns, rows);
        downloadBlob(blob, filename, fmtMeta.mime);
      } else if (format === 'csv' || format === 'tsv') {
        const content = generateCSVContent(columns, rows, {
          separator: format === 'csv' ? ',' : '\t',
          includeHeaders: csvHeaders,
        });
        downloadBlob(content, filename, fmtMeta.mime);
      } else if (format === 'json') {
        const content = generateJSONContent(rows, jsonPretty);
        downloadBlob(content, filename, fmtMeta.mime);
      } else if (format === 'ndjson') {
        const content = generateNDJSONContent(rows);
        downloadBlob(content, filename, fmtMeta.mime);
      } else if (format === 'sql') {
        const content = generateSQLContent(columns, rows, table, {
          dialect: databaseType,
          schema: sqlQualified ? schema : undefined,
        });
        downloadBlob(content, filename, fmtMeta.mime);
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
              Current view{filters.length > 0 ? ' (filtered + sorted)' : sortColumn ? ' (sorted)' : ''}
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
                {filters.length > 0 ? `${currentTotal} matching` : `${currentTotal} rows`}
              </span>
            </span>
          </label>
        </fieldset>

        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {FORMAT_OPTIONS.map((o) => (
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
            {showSqlOpts && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={sqlQualified}
                  onChange={(e) => setSqlQualified(e.target.checked)}
                />
                Use schema-qualified table name (<span className="font-mono text-xs">{schema}.{table}</span>)
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
