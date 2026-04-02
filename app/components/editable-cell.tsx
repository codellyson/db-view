'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface EditableCellProps {
  value: any;
  column: string;
  columnType?: string;
  onSave: (column: string, newValue: any) => void;
  onCancel: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
  disabled?: boolean;
}

type EditorKind = 'text' | 'number' | 'boolean' | 'json' | 'textarea';

function inferEditor(columnType?: string, value?: any): EditorKind {
  if (!columnType) return 'text';
  const t = columnType.toLowerCase();

  if (t === 'boolean' || t === 'bool') return 'boolean';
  if (t === 'json' || t === 'jsonb') return 'json';
  if (t.includes('int') || t === 'numeric' || t === 'decimal' ||
      t === 'real' || t === 'float' || t.includes('double') ||
      t === 'smallserial' || t === 'serial' || t === 'bigserial') return 'number';
  if (t === 'text' || t.includes('varchar') || t.includes('char')) {
    // Use textarea for long values
    if (value !== null && value !== undefined && String(value).length > 60) return 'textarea';
  }

  return 'text';
}

function formatForEditor(value: any, kind: EditorKind): string {
  if (value === null || value === undefined) return '';
  if (kind === 'json') {
    try {
      return typeof value === 'string' ? JSON.stringify(JSON.parse(value), null, 2) : JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  column,
  columnType,
  onSave,
  onCancel,
  isEditing,
  onStartEdit,
  disabled = false,
}) => {
  const editorKind = inferEditor(columnType, value);
  const [editValue, setEditValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(formatForEditor(value, editorKind));
      setJsonError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        textareaRef.current?.focus();
      }, 0);
    }
  }, [isEditing, value, editorKind]);

  const save = useCallback(() => {
    if (editValue === '') {
      onSave(column, null);
      return;
    }

    if (editorKind === 'json') {
      try {
        JSON.parse(editValue);
        setJsonError(null);
      } catch (e: any) {
        setJsonError(e.message);
        return;
      }
    }

    if (editorKind === 'boolean') {
      onSave(column, editValue);
      return;
    }

    onSave(column, editValue);
  }, [column, editValue, editorKind, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // For textarea/json: Enter inserts newline, Cmd+Enter saves
    if (editorKind === 'json' || editorKind === 'textarea') {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
      // Tab saves
      if (e.key === 'Tab') {
        e.preventDefault();
        save();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      save();
    }
  };

  if (isEditing) {
    // Boolean: dropdown
    if (editorKind === 'boolean') {
      return (
        <select
          value={editValue === '' ? '' : editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => save()}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full px-2 py-1 text-sm font-mono border border-accent rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">NULL</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    // JSON / long text: portal-mounted modal editor (escapes overflow-hidden parents)
    if (editorKind === 'json' || editorKind === 'textarea') {
      return createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
          <div className="relative z-10 bg-bg border border-border rounded-lg shadow-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">{column}</span>
                <span className="text-xs text-muted font-mono">{columnType}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <kbd className="px-1.5 py-0.5 bg-bg-secondary rounded border border-border text-[10px]">
                  {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                </kbd>
                <span>to save</span>
              </div>
            </div>
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  if (jsonError) setJsonError(null);
                }}
                onKeyDown={handleKeyDown}
                rows={Math.min(15, Math.max(4, editValue.split('\n').length + 1))}
                spellCheck={false}
                className={`w-full px-3 py-2 text-sm font-mono border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 resize-y ${
                  jsonError ? 'border-danger focus:ring-danger' : 'border-border focus:ring-accent'
                }`}
              />
              {jsonError && (
                <p className="text-xs text-danger mt-1.5">{jsonError}</p>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <button
                onClick={() => { setEditValue(''); save(); }}
                className="text-xs text-muted hover:text-primary transition-colors"
              >
                Set NULL
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 text-sm text-secondary hover:bg-bg-secondary rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="px-3 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      );
    }

    // Number input
    if (editorKind === 'number') {
      return (
        <input
          ref={inputRef}
          type="number"
          step="any"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onCancel()}
          className="w-full px-2 py-1 text-sm font-mono border border-accent rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      );
    }

    // Default: text input
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onCancel()}
        className="w-full px-2 py-1 text-sm font-mono border border-accent rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
      />
    );
  }

  const displayValue = value !== null && value !== undefined
    ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
    : null;

  return (
    <div
      className={`truncate ${!disabled ? 'cursor-text' : ''}`}
      onDoubleClick={!disabled ? onStartEdit : undefined}
      title={displayValue || 'NULL'}
    >
      {displayValue !== null ? (
        displayValue
      ) : (
        <span className="text-muted italic">NULL</span>
      )}
    </div>
  );
};
