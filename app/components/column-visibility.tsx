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
        className="px-4 py-2 text-sm font-bold uppercase font-mono border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        COLUMNS {hiddenCount > 0 && `(${hiddenCount} HIDDEN)`}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-black border-2 border-black dark:border-white shadow-[4px_4px_0_0_black] dark:shadow-[4px_4px_0_0_white] min-w-[200px] max-h-[300px] overflow-y-auto">
          <div className="flex border-b-2 border-black dark:border-white">
            <button
              onClick={onShowAll}
              className="flex-1 px-3 py-2 text-xs font-bold uppercase font-mono text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black border-r border-black dark:border-white"
            >
              ALL
            </button>
            <button
              onClick={onHideAll}
              className="flex-1 px-3 py-2 text-xs font-bold uppercase font-mono text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            >
              NONE
            </button>
          </div>
          {columns.map((column) => (
            <label
              key={column}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/10 dark:border-white/10 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(column)}
                onChange={() => onToggle(column)}
                className="w-4 h-4 appearance-none border-2 border-black dark:border-white checked:bg-black dark:checked:bg-white cursor-pointer"
              />
              <span className="text-xs font-mono font-bold uppercase text-black dark:text-white truncate">
                {column}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
