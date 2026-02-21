'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ColumnVisibilityProps {
  columns: string[];
  visibleColumns: string[];
  onToggle: (column: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export const ColumnVisibility: React.FC<ColumnVisibilityProps> = ({
  columns,
  visibleColumns,
  onToggle,
  onShowAll,
  onHideAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const hiddenCount = columns.length - visibleColumns.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg text-primary hover:bg-bg-secondary transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Columns {hiddenCount > 0 && <span className="text-muted">({hiddenCount} hidden)</span>}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-bg border border-border rounded-lg shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto">
          <div className="flex border-b border-border">
            <button
              onClick={onShowAll}
              className="flex-1 px-3 py-2 text-xs text-secondary hover:bg-bg-secondary transition-colors border-r border-border"
            >
              Show all
            </button>
            <button
              onClick={onHideAll}
              className="flex-1 px-3 py-2 text-xs text-secondary hover:bg-bg-secondary transition-colors"
            >
              Hide all
            </button>
          </div>
          {columns.map((column) => (
            <label
              key={column}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-bg-secondary/50 border-b border-border/50 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(column)}
                onChange={() => onToggle(column)}
                className="w-3.5 h-3.5 rounded border border-border accent-accent cursor-pointer"
              />
              <span className="text-xs text-primary font-mono truncate">
                {column}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
