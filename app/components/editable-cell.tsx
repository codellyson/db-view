'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
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

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
}

// Pin the popover to the cell's top-left, widen beyond the cell if needed,
// and shift back into the viewport if the right/bottom edge would clip.
function computePosition(anchor: DOMRect, popoverSize: { width: number; height: number }): PopoverPosition {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const desiredWidth = Math.max(popoverSize.width, anchor.width);

  let left = anchor.left;
  if (left + desiredWidth + margin > vw) left = Math.max(margin, vw - desiredWidth - margin);

  let top = anchor.top;
  if (top + popoverSize.height + margin > vh) {
    // Flip above the cell if there's more room up there.
    const aboveTop = anchor.top - popoverSize.height - 4;
    top = aboveTop > margin ? aboveTop : Math.max(margin, vh - popoverSize.height - margin);
  }

  return { top, left, width: desiredWidth };
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
  const isLargeEditor = editorKind === 'json' || editorKind === 'textarea';

  const [editValue, setEditValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const cellRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Snap the editValue back to the current cell value whenever we enter edit mode.
  useEffect(() => {
    if (isEditing) {
      setEditValue(formatForEditor(value, editorKind));
      setJsonError(null);
    }
  }, [isEditing, value, editorKind]);

  // Position the popover relative to the cell, then re-position on scroll/resize
  // so it stays anchored. Cancel the edit if the underlying cell scrolls off-screen
  // far enough that the popover would float orphaned.
  useLayoutEffect(() => {
    if (!isEditing) {
      setPosition(null);
      return;
    }
    const popoverSize = isLargeEditor
      ? { width: 520, height: 340 }
      : { width: 320, height: 112 };

    const place = () => {
      const anchor = cellRef.current?.getBoundingClientRect();
      if (!anchor) return;
      setPosition(computePosition(anchor, popoverSize));
    };
    place();

    const onScrollOrResize = () => place();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isEditing, isLargeEditor]);

  // Focus the relevant field once the popover is on screen.
  useEffect(() => {
    if (!isEditing || !position) return;
    const t = setTimeout(() => {
      if (isLargeEditor) {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        if (inputRef.current && 'select' in inputRef.current) {
          (inputRef.current as HTMLInputElement).select();
        }
      }
    }, 0);
    return () => clearTimeout(t);
  }, [isEditing, position, isLargeEditor]);

  // Outside-click cancels. Uses mousedown so it fires before focus changes
  // confuse the buttons inside the popover.
  useEffect(() => {
    if (!isEditing) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (cellRef.current?.contains(target)) return;
      onCancel();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isEditing, onCancel]);

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
    onSave(column, editValue);
  }, [column, editValue, editorKind, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    // Large editors: Enter inserts newline, Mod+Enter saves.
    if (isLargeEditor) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      save();
    }
  };

  // ─── Display (non-editing) ────────────────────────────────────
  const displayValue = value !== null && value !== undefined
    ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
    : null;

  return (
    <>
      <div
        ref={cellRef}
        className={`truncate ${!disabled ? 'cursor-text' : ''} ${isEditing ? 'opacity-40' : ''}`}
        onDoubleClick={!disabled ? onStartEdit : undefined}
        title={displayValue || 'NULL'}
      >
        {displayValue !== null ? (
          displayValue
        ) : (
          <span className="text-muted italic">NULL</span>
        )}
      </div>

      {isEditing && position && typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 bg-bg border border-border rounded-md shadow-xl flex flex-col overflow-hidden"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header: column name + type */}
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border bg-bg-secondary/40 flex-shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-medium text-primary truncate">{column}</span>
                {columnType && (
                  <span className="text-[10px] font-mono text-muted flex-shrink-0">{columnType}</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted flex-shrink-0">
                <kbd className="px-1 py-0.5 bg-bg rounded border border-border">
                  {isLargeEditor
                    ? (typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl') + '+Enter'
                    : 'Enter'}
                </kbd>
                <span>save</span>
              </div>
            </div>

            {/* Body: input */}
            <div className="p-2 flex-1 min-h-0">
              {editorKind === 'boolean' ? (
                <select
                  ref={inputRef as React.RefObject<HTMLSelectElement>}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-2 py-1.5 text-sm font-mono border border-border rounded bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">NULL</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : isLargeEditor ? (
                <textarea
                  ref={textareaRef}
                  value={editValue}
                  onChange={(e) => {
                    setEditValue(e.target.value);
                    if (jsonError) setJsonError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  rows={12}
                  spellCheck={false}
                  className={`w-full h-full px-2 py-1.5 text-sm font-mono border rounded bg-bg text-primary focus:outline-none focus:ring-2 resize-none ${
                    jsonError ? 'border-danger focus:ring-danger' : 'border-border focus:ring-accent'
                  }`}
                />
              ) : (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type={editorKind === 'number' ? 'number' : 'text'}
                  step={editorKind === 'number' ? 'any' : undefined}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-2 py-1.5 text-sm font-mono border border-border rounded bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              )}
              {jsonError && (
                <p className="text-[11px] text-danger mt-1.5">{jsonError}</p>
              )}
            </div>

            {/* Footer: actions */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-border bg-bg-secondary/30 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setEditValue(''); save(); }}
                className="text-[11px] text-muted hover:text-primary transition-colors px-1.5 py-0.5"
                title="Set this cell to NULL"
              >
                Set NULL
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-2.5 py-1 text-[11px] font-medium text-secondary hover:text-primary hover:bg-bg-secondary rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="px-2.5 py-1 text-[11px] font-medium text-white bg-accent hover:bg-accent-hover rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
