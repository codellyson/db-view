'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ContextMenu, useContextMenu, type ContextMenuEntry } from './ui/context-menu';

interface TableListProps {
  tables: string[];
  selectedTable?: string;
  onSelect: (table: string) => void;
  onViewStructure?: (table: string) => void;
  onExportTable?: (table: string) => void;
  onOpenInQuery?: (table: string) => void;
  onDropTable?: (table: string) => void;
}

export const TableList: React.FC<TableListProps> = ({
  tables,
  selectedTable,
  onSelect,
  onViewStructure,
  onExportTable,
  onOpenInQuery,
  onDropTable,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const { menu: contextMenu, show: showContextMenu, close: closeContextMenu } = useContextMenu();

  const handleTableContextMenu = (e: React.MouseEvent, table: string) => {
    const items: ContextMenuEntry[] = [
      { label: 'Copy name', onClick: () => navigator.clipboard.writeText(table) },
    ];
    if (onViewStructure) {
      items.push({ label: 'View structure', onClick: () => onViewStructure(table) });
    }
    if (onOpenInQuery) {
      items.push({ label: 'Open in query editor', onClick: () => onOpenInQuery(table) });
    }
    if (onExportTable) {
      items.push(
        { type: 'divider' },
        { label: 'Export table', onClick: () => onExportTable(table) },
      );
    }
    if (onDropTable) {
      items.push(
        { type: 'divider' },
        { label: 'Drop table', onClick: () => onDropTable(table), danger: true },
      );
    }
    showContextMenu(e, items);
  };

  const filteredTables = tables.filter((table) =>
    table.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredTables.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = focusedIndex < filteredTables.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(next);
        const el = listRef.current?.children[next]?.querySelector('button');
        el?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = focusedIndex > 0 ? focusedIndex - 1 : filteredTables.length - 1;
        setFocusedIndex(prev);
        const el = listRef.current?.children[prev]?.querySelector('button');
        el?.focus();
        break;
      }
      case 'Enter': {
        if (focusedIndex >= 0 && focusedIndex < filteredTables.length) {
          onSelect(filteredTables[focusedIndex]);
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        setFocusedIndex(0);
        const el = listRef.current?.children[0]?.querySelector('button');
        el?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const last = filteredTables.length - 1;
        setFocusedIndex(last);
        const el = listRef.current?.children[last]?.querySelector('button');
        el?.focus();
        break;
      }
    }
  }, [filteredTables, focusedIndex, onSelect]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && filteredTables.length > 0) {
      e.preventDefault();
      setFocusedIndex(0);
      const el = listRef.current?.children[0]?.querySelector('button');
      el?.focus();
    }
  };

  return (
    <div>
      <div className="relative mb-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setFocusedIndex(-1); }}
          onKeyDown={handleSearchKeyDown}
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-bg-secondary/50 text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 focus:bg-bg transition-colors"
          aria-label="Search tables"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); setFocusedIndex(-1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
            aria-label="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <ul
        ref={listRef}
        className="space-y-px"
        role="listbox"
        aria-label="Tables"
        onKeyDown={handleKeyDown}
      >
        {filteredTables.map((table, index) => (
          <li key={table} role="option" aria-selected={selectedTable === table}>
            <button
              onClick={() => onSelect(table)}
              onFocus={() => setFocusedIndex(index)}
              onContextMenu={(e) => handleTableContextMenu(e, table)}
              tabIndex={focusedIndex === index ? 0 : -1}
              className={`group w-full text-left px-2.5 py-1.5 text-[13px] rounded-md truncate transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-accent/40 flex items-center gap-2 ${
                selectedTable === table
                  ? 'bg-accent/10 text-accent font-medium shadow-sm shadow-accent/5'
                  : 'text-secondary hover:text-primary hover:bg-bg-secondary'
              }`}
              title={table}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${
                  selectedTable === table ? 'text-accent' : 'text-muted group-hover:text-secondary'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-7.5c-.621 0-1.125.504-1.125 1.125M12 12h7.5c.621 0 1.125.504 1.125 1.125" />
              </svg>
              <span className="truncate">{table}</span>
            </button>
          </li>
        ))}
        {filteredTables.length === 0 && (
          <li className="text-xs text-muted px-3 py-4 text-center">
            No tables matching &ldquo;{searchQuery}&rdquo;
          </li>
        )}
      </ul>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};
