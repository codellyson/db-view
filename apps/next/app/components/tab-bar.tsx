'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu, useContextMenu, type ContextMenuEntry } from './ui/context-menu';

export interface Tab {
  id: string;
  label: string;
  type: 'table' | 'view' | 'matview' | 'query' | 'editor';
  pinned?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | undefined;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCloseOthers?: (tabId: string) => void;
  onTabCloseAll?: () => void;
  onTabReorder?: (fromId: string, toId: string) => void;
  onTabTogglePin?: (tabId: string) => void;
  actions?: React.ReactNode;
}

const TYPE_BADGE: Record<Tab['type'], string> = {
  query: 'Q',
  editor: 'E',
  table: 'T',
  view: 'V',
  matview: 'MV',
};

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabCloseOthers,
  onTabCloseAll,
  onTabReorder,
  onTabTogglePin,
  actions,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeElRef = useRef<HTMLButtonElement | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLElement | null>>({});
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const { menu, show, close } = useContextMenu();
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowAnchorRef = useRef<HTMLButtonElement>(null);

  // Pinned tabs first; preserve user-set order within each group.
  const ordered = useMemo(() => {
    const pinned = tabs.filter((t) => t.pinned);
    const rest = tabs.filter((t) => !t.pinned);
    return [...pinned, ...rest];
  }, [tabs]);

  // Scroll active tab into view.
  useEffect(() => {
    activeElRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  // Track which tabs are not fully visible in the scroll container so the
  // overflow `…` button can list them. Re-runs on resize and when tabs change.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const compute = () => {
      const next = new Set<string>();
      for (const tab of ordered) {
        const el = tabRefs.current[tab.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const r = root.getBoundingClientRect();
        if (rect.right > r.right + 1 || rect.left < r.left - 1) next.add(tab.id);
      }
      setOverflowIds(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(root);
    root.addEventListener('scroll', compute);
    return () => {
      ro.disconnect();
      root.removeEventListener('scroll', compute);
    };
  }, [ordered]);

  if (tabs.length === 0 && !actions) return null;

  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onTabClose(tabId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    const items: ContextMenuEntry[] = [];
    if (onTabTogglePin) {
      items.push({
        label: tab.pinned ? 'Unpin' : 'Pin tab',
        onClick: () => onTabTogglePin(tab.id),
      });
      items.push({ type: 'divider' });
    }
    items.push({ label: 'Close', onClick: () => onTabClose(tab.id) });
    if (onTabCloseOthers) {
      items.push({ label: 'Close others', onClick: () => onTabCloseOthers(tab.id) });
    }
    if (onTabCloseAll) {
      items.push({ label: 'Close all', onClick: onTabCloseAll });
    }
    show(e, items);
  };

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    if (!onTabReorder) return;
    dragIdRef.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!onTabReorder || !dragIdRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (!onTabReorder) return;
    e.preventDefault();
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId || fromId === targetId) return;
    onTabReorder(fromId, targetId);
  };

  return (
    <div className="flex items-center border-b border-border bg-bg-secondary/30 min-h-[36px]">
      {actions && (
        <div className="flex items-center gap-0.5 px-1 border-r border-border flex-shrink-0">
          {actions}
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex items-end overflow-x-auto scrollbar-none flex-1"
        role="tablist"
      >
        {ordered.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isPinned = !!tab.pinned;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
                if (isActive) activeElRef.current = el;
              }}
              role="tab"
              aria-selected={isActive}
              draggable={!!onTabReorder}
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, tab.id)}
              onClick={() => onTabSelect(tab.id)}
              onMouseDown={(e) => handleMiddleClick(e, tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              className={`group relative flex items-center gap-1.5 ${isPinned ? 'px-2' : 'px-3'} py-2 text-xs font-medium border-r border-border whitespace-nowrap transition-colors ${
                isPinned ? 'max-w-[80px]' : 'max-w-[180px]'
              } ${
                isActive
                  ? 'bg-bg text-primary border-b-2 border-b-accent -mb-px'
                  : 'text-muted hover:text-secondary hover:bg-bg-secondary/50'
              }`}
              title={tab.label}
            >
              {isPinned && (
                <span className="text-warning text-[10px] flex-shrink-0" aria-label="Pinned">★</span>
              )}
              <span
                className={`flex-shrink-0 font-mono text-[9px] px-1 py-px rounded ${
                  isActive ? 'bg-accent/10 text-accent' : 'bg-bg-secondary text-muted'
                }`}
              >
                {TYPE_BADGE[tab.type]}
              </span>
              {!isPinned && <span className="truncate">{tab.label}</span>}
              {!isPinned && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                  className={`flex-shrink-0 p-0.5 rounded hover:bg-danger/10 hover:text-danger transition-colors ${
                    isActive ? 'text-muted' : 'text-transparent group-hover:text-muted'
                  }`}
                  aria-label={`Close ${tab.label}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {overflowIds.size > 0 && (
        <div className="relative flex-shrink-0">
          <button
            ref={overflowAnchorRef}
            onClick={() => setShowOverflowMenu((v) => !v)}
            className="px-2 py-1.5 text-muted hover:text-primary hover:bg-bg-secondary/50 text-xs transition-colors"
            title={`${overflowIds.size} more tab${overflowIds.size === 1 ? '' : 's'}`}
            aria-label="Overflow menu"
            aria-expanded={showOverflowMenu}
          >
            … <span className="font-mono">{overflowIds.size}</span>
          </button>
          {showOverflowMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowOverflowMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-full mt-1 z-40 min-w-[200px] max-w-[300px] max-h-[60vh] overflow-y-auto bg-bg border border-border rounded shadow-lg py-1">
                {ordered
                  .filter((t) => overflowIds.has(t.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onTabSelect(t.id);
                        setShowOverflowMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-bg-secondary transition-colors ${
                        t.id === activeTabId ? 'text-accent' : 'text-secondary'
                      }`}
                    >
                      <span className="font-mono text-[9px] px-1 py-px rounded bg-bg-secondary text-muted flex-shrink-0">
                        {TYPE_BADGE[t.type]}
                      </span>
                      <span className="truncate">{t.label}</span>
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
      {tabs.length > 1 && onTabCloseAll && (
        <button
          onClick={onTabCloseAll}
          className="flex-shrink-0 px-2 py-1.5 text-muted hover:text-primary text-[10px] hover:bg-bg-secondary/50 transition-colors"
          title="Close all tabs"
          aria-label="Close all tabs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={close} />}
    </div>
  );
};
