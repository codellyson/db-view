'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ValuePanelProps {
  column: string;
  value: any;
  columnType?: string;
  onClose: () => void;
  onSave?: (newValue: string | null) => void;
}

type ViewMode = 'text' | 'json';

function stringify(value: any): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

export const ValuePanel: React.FC<ValuePanelProps> = ({
  column,
  value,
  columnType,
  onClose,
  onSave,
}) => {
  const raw = stringify(value);
  const isNull = value === null || value === undefined;
  const canEdit = !!onSave;

  const isJsonLike = (() => {
    if (!raw) return false;
    const trimmed = raw.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  })();

  const [viewMode, setViewMode] = useState<ViewMode>(isJsonLike ? 'json' : 'text');
  const [editValue, setEditValue] = useState(raw ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when a different cell is selected
  useEffect(() => {
    const newRaw = stringify(value);
    setEditValue(newRaw ?? '');
    setIsDirty(false);
  }, [value, column]);

  const handleChange = (newVal: string) => {
    setEditValue(newVal);
    setIsDirty(newVal !== (raw ?? ''));
  };

  const handleSave = () => {
    if (!onSave || !isDirty) return;
    onSave(editValue === '' ? null : editValue);
    setIsDirty(false);
  };

  const handleDiscard = () => {
    setEditValue(raw ?? '');
    setIsDirty(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editValue || raw || '');
  };

  const displayValue = viewMode === 'json' && isJsonLike
    ? (() => { try { return JSON.stringify(JSON.parse(editValue), null, 2); } catch { return editValue; } })()
    : editValue;

  return (
    <div className="flex flex-col border-l border-border bg-bg rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: '250px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span className="text-xs font-medium text-primary truncate">{column}</span>
          {columnType && (
            <span className="text-[10px] font-mono text-muted bg-bg-secondary px-1.5 py-0.5 rounded flex-shrink-0">
              {columnType}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-muted hover:text-primary rounded hover:bg-bg-secondary transition-colors flex-shrink-0"
          aria-label="Close value panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* View mode tabs + actions */}
      <div className="flex items-center gap-px px-3 py-1.5 border-b border-border bg-bg-secondary/30 flex-shrink-0">
        <button
          onClick={() => setViewMode('text')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
            viewMode === 'text'
              ? 'bg-accent/10 text-accent'
              : 'text-muted hover:text-primary hover:bg-bg-secondary'
          }`}
        >
          Text
        </button>
        {isJsonLike && (
          <button
            onClick={() => setViewMode('json')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              viewMode === 'json'
                ? 'bg-accent/10 text-accent'
                : 'text-muted hover:text-primary hover:bg-bg-secondary'
            }`}
          >
            JSON
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          className="p-1 text-muted hover:text-primary rounded hover:bg-bg-secondary transition-colors"
          title="Copy to clipboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Value content */}
      <div className="flex-1 overflow-auto p-3">
        <textarea
          ref={textareaRef}
          value={viewMode === 'json' ? displayValue : editValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={isNull ? 'NULL' : ''}
          readOnly={viewMode === 'json'}
          className={`w-full h-full text-sm font-mono bg-transparent resize-none focus:outline-none leading-relaxed ${isNull && !isDirty ? 'text-muted italic' : 'text-primary'}`}
          spellCheck={false}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-bg-secondary/30 flex-shrink-0">
        <span className="text-[10px] text-muted">Length: {editValue.length}</span>
        <span className="text-[10px] text-muted">Lines: {editValue.split('\n').length}</span>
        <div className="flex-1" />
        {isDirty && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDiscard}
              className="px-2 py-0.5 text-[11px] font-medium text-muted hover:text-primary rounded hover:bg-bg-secondary transition-colors"
            >
              Cancel
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                className="px-2 py-0.5 text-[11px] font-medium text-white bg-accent rounded hover:bg-accent/80 transition-colors"
              >
                Save
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
