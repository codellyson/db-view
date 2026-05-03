'use client';

import React, { useState } from 'react';

interface SmartCellDisplayProps {
  value: any;
  column?: string;
  columnType?: string;
  /** When true, ISO timestamp is shown raw instead of locale-formatted. */
  rawTimestamps?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidType(columnType?: string): boolean {
  return columnType?.toLowerCase() === 'uuid';
}

function isJsonType(columnType?: string): boolean {
  const t = columnType?.toLowerCase();
  return t === 'json' || t === 'jsonb';
}

function isBoolType(columnType?: string): boolean {
  const t = columnType?.toLowerCase();
  return t === 'boolean' || t === 'bool';
}

function isDateType(columnType?: string): boolean {
  const t = columnType?.toLowerCase() ?? '';
  return (
    t === 'date' ||
    t === 'timestamp' ||
    t === 'timestamptz' ||
    t === 'timestamp without time zone' ||
    t === 'timestamp with time zone' ||
    t === 'datetime'
  );
}

const IMAGE_NAME_RE = /^(image|avatar|photo|picture|thumbnail|cover|logo)(_url|url)?$/i;
const IMAGE_URL_RE = /^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|svg|avif)(\?[^\s]*)?$/i;

function looksLikeImage(column?: string, value?: any): boolean {
  if (typeof value !== 'string') return false;
  if (column && IMAGE_NAME_RE.test(column)) return true;
  return IMAGE_URL_RE.test(value);
}

function formatTimestamp(value: any, raw: boolean): string {
  if (raw) return String(value);
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export const SmartCellDisplay: React.FC<SmartCellDisplayProps> = ({
  value,
  column,
  columnType,
  rawTimestamps,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (value === null || value === undefined) {
    return <span className="text-muted italic">NULL</span>;
  }

  if (isBoolType(columnType) || typeof value === 'boolean') {
    const truthy = value === true || value === 'true' || value === 't' || value === 1 || value === '1';
    return <span title={String(value)}>{truthy ? 'true' : 'false'}</span>;
  }

  // UUID → truncated + copy on hover. Detect by type or by string shape.
  const valueStr = typeof value === 'string' ? value : '';
  if ((isUuidType(columnType) || UUID_RE.test(valueStr)) && valueStr) {
    const truncated = valueStr.slice(0, 8) + '…';
    return (
      <span className="inline-flex items-center gap-1 group/uuid" title={valueStr}>
        <span className="font-mono">{truncated}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(valueStr).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
          className="opacity-0 group-hover/uuid:opacity-100 text-muted hover:text-primary transition-opacity"
          aria-label="Copy UUID"
        >
          {copied ? (
            <svg className="w-3 h-3 text-success" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3 3 7-7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="5" y="5" width="9" height="9" rx="1" />
              <path d="M3 11V3a1 1 0 011-1h8" />
            </svg>
          )}
        </button>
      </span>
    );
  }

  // JSON / JSONB / object → {} icon + click-to-expand pretty-print.
  if (isJsonType(columnType) || typeof value === 'object') {
    const pretty = (() => {
      try {
        const obj = typeof value === 'string' ? JSON.parse(value) : value;
        return JSON.stringify(obj, null, 2);
      } catch {
        return String(value);
      }
    })();
    if (expanded) {
      return (
        <pre
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="cursor-pointer max-w-md text-[11px] font-mono whitespace-pre-wrap break-all bg-bg-secondary/40 p-2 rounded border border-border"
          title="Click to collapse"
        >
          {pretty}
        </pre>
      );
    }
    const inline =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    return (
      <span
        className="inline-flex items-center gap-1 cursor-pointer hover:text-primary"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        title="Click to pretty-print"
      >
        <span className="text-[10px] text-accent font-mono">{'{}'}</span>
        <span className="truncate">{inline}</span>
      </span>
    );
  }

  // Image preview.
  if (looksLikeImage(column, value)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <img
          src={valueStr}
          alt=""
          className="h-5 w-5 rounded object-cover bg-bg-secondary flex-shrink-0"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="truncate text-muted">{valueStr}</span>
      </span>
    );
  }

  // Timestamp / date — format in user's locale.
  if (isDateType(columnType)) {
    const formatted = formatTimestamp(value, !!rawTimestamps);
    return <span title={String(value)}>{formatted}</span>;
  }

  // Long text — hover tooltip + click to expand inline.
  const stringValue = String(value);
  if (stringValue.length > 100) {
    if (expanded) {
      return (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="cursor-pointer break-all whitespace-pre-wrap"
          title="Click to collapse"
        >
          {stringValue}
        </span>
      );
    }
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        title={stringValue}
        className="cursor-pointer hover:text-primary"
      >
        {stringValue.slice(0, 80)}
        <span className="text-muted">… {stringValue.length} chars</span>
      </span>
    );
  }

  return <span title={stringValue}>{stringValue}</span>;
};
