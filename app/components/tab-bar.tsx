'use client';

import React, { useRef, useEffect } from 'react';

export interface Tab {
  id: string;
  label: string;
  type: 'table' | 'view' | 'matview' | 'query';
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | undefined;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCloseOthers?: (tabId: string) => void;
  onTabCloseAll?: () => void;
  actions?: React.ReactNode;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabCloseOthers,
  onTabCloseAll,
  actions,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  if (tabs.length === 0 && !actions) return null;

  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onTabClose(tabId);
    }
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
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : undefined}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabSelect(tab.id)}
              onMouseDown={(e) => handleMiddleClick(e, tab.id)}
              className={`group relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-border whitespace-nowrap transition-colors max-w-[180px] ${
                isActive
                  ? 'bg-bg text-primary border-b-2 border-b-accent -mb-px'
                  : 'text-muted hover:text-secondary hover:bg-bg-secondary/50'
              }`}
              title={tab.label}
            >
              <span className={`flex-shrink-0 font-mono text-[9px] px-1 py-px rounded ${
                isActive ? 'bg-accent/10 text-accent' : 'bg-bg-secondary text-muted'
              }`}>
                {tab.type === 'query' ? 'Q' : tab.type === 'table' ? 'T' : tab.type === 'view' ? 'V' : 'MV'}
              </span>
              <span className="truncate">{tab.label}</span>
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
            </button>
          );
        })}
      </div>
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
    </div>
  );
};
