'use client';

import React, { useState } from 'react';
import { TableList } from './table-list';
import { SidebarSkeleton } from './skeletons/sidebar-skeleton';
import type { SavedQuery } from '@/types';

interface FunctionInfo {
  name: string;
  arguments: string;
  return_type: string;
  language: string;
  kind: string;
}

interface SidebarProps {
  tables: string[];
  selectedTable?: string;
  onTableSelect: (table: string) => void;
  isLoading?: boolean;
  schemas?: string[];
  selectedSchema?: string;
  onSchemaChange?: (schema: string) => void;
  views?: string[];
  materializedViews?: string[];
  functions?: FunctionInfo[];
  onCreateTable?: () => void;
  onBatchExport?: () => void;
  // Sidebar prefs for the main "Tables" list. Owned upstream so the dashboard
  // can also record opens when tables are selected from elsewhere (FK panel,
  // table picker, etc.).
  pinnedTables?: string[];
  recentTables?: string[];
  onTogglePin?: (table: string) => void;
  groupByPrefix?: boolean;
  onToggleGroupByPrefix?: () => void;
  rowCounts?: Record<string, number | undefined>;
  // Saved queries — when provided, render a Saved section.
  savedQueries?: SavedQuery[];
  onOpenSavedQuery?: (query: SavedQuery) => void;
  onDeleteSavedQuery?: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  tables,
  selectedTable,
  onTableSelect,
  isLoading = false,
  schemas,
  selectedSchema = 'public',
  onSchemaChange,
  views = [],
  materializedViews = [],
  functions = [],
  onCreateTable,
  onBatchExport,
  pinnedTables,
  recentTables,
  onTogglePin,
  groupByPrefix,
  onToggleGroupByPrefix,
  rowCounts,
  savedQueries,
  onOpenSavedQuery,
  onDeleteSavedQuery,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tables: true,
    views: true,
    matviews: true,
    functions: false,
    saved: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside className="w-full bg-bg h-screen overflow-y-auto border-r border-border" aria-label="Database sidebar">
      <div className="p-3">
        {schemas && schemas.length > 1 && onSchemaChange && (
          <div className="mb-3">
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted mb-1.5 px-1">
              Schema
            </label>
            <div className="relative">
              <select
                value={selectedSchema}
                onChange={(e) => onSchemaChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-bg-secondary/50 text-primary focus:outline-none focus:ring-1 focus:ring-accent/40 appearance-none cursor-pointer hover:bg-bg-secondary transition-colors"
                aria-label="Select database schema"
              >
                {schemas.map((schema) => (
                  <option key={schema} value={schema}>
                    {schema}
                  </option>
                ))}
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <div className="space-y-1">
            <SidebarSection
              title="Tables"
              count={tables.length}
              icon="T"
              isExpanded={expandedSections.tables}
              onToggle={() => toggleSection('tables')}
              onAction={onCreateTable}
              actionLabel="Create table"
              extraActions={
                onBatchExport && tables.length > 0 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onBatchExport(); }}
                    className="p-1 text-muted/0 group-hover/section:text-muted hover:!text-accent rounded transition-all"
                    title="Batch export tables"
                    aria-label="Batch export tables"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  </button>
                ) : undefined
              }
            >
              <TableList
                tables={tables}
                selectedTable={selectedTable}
                onSelect={onTableSelect}
                pinned={pinnedTables}
                recent={recentTables}
                onTogglePin={onTogglePin}
                groupByPrefix={groupByPrefix}
                onToggleGroupByPrefix={onToggleGroupByPrefix}
                rowCounts={rowCounts}
              />
            </SidebarSection>

            {views.length > 0 && (
              <SidebarSection
                title="Views"
                count={views.length}
                icon="V"
                isExpanded={expandedSections.views}
                onToggle={() => toggleSection('views')}
              >
                <TableList
                  tables={views}
                  selectedTable={selectedTable}
                  onSelect={onTableSelect}
                />
              </SidebarSection>
            )}

            {materializedViews.length > 0 && (
              <SidebarSection
                title="Mat. Views"
                count={materializedViews.length}
                icon="MV"
                isExpanded={expandedSections.matviews}
                onToggle={() => toggleSection('matviews')}
              >
                <TableList
                  tables={materializedViews}
                  selectedTable={selectedTable}
                  onSelect={onTableSelect}
                />
              </SidebarSection>
            )}

            {savedQueries && savedQueries.length > 0 && onOpenSavedQuery && (
              <SidebarSection
                title="Saved"
                count={savedQueries.length}
                icon="S"
                isExpanded={expandedSections.saved}
                onToggle={() => toggleSection('saved')}
              >
                <ul className="space-y-px">
                  {savedQueries.map((q) => (
                    <li key={q.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => onOpenSavedQuery(q)}
                        className="flex-1 text-left px-2.5 py-1.5 text-[13px] rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors truncate"
                        title={q.query}
                      >
                        <span className="truncate">{q.name}</span>
                      </button>
                      {onDeleteSavedQuery && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteSavedQuery(q.id); }}
                          className="p-1 text-muted/0 group-hover:text-muted hover:!text-danger transition-all"
                          title="Delete saved query"
                          aria-label="Delete saved query"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </SidebarSection>
            )}

            {functions.length > 0 && (
              <SidebarSection
                title="Functions"
                count={functions.length}
                icon="F"
                isExpanded={expandedSections.functions}
                onToggle={() => toggleSection('functions')}
              >
                <div className="space-y-px">
                  {functions.map((fn, i) => (
                    <div
                      key={i}
                      className="group px-2.5 py-1.5 text-[13px] rounded-md hover:bg-bg-secondary flex items-start gap-2 transition-colors cursor-default"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted group-hover:text-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                      <div className="min-w-0">
                        <div className="font-medium text-secondary group-hover:text-primary truncate transition-colors">{fn.name}</div>
                        <div className="text-[11px] text-muted font-mono truncate">
                          ({fn.arguments}) &rarr; {fn.return_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SidebarSection>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

const SidebarSection: React.FC<{
  title: string;
  count: number;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  extraActions?: React.ReactNode;
}> = ({ title, count, icon, isExpanded, onToggle, children, onAction, actionLabel, extraActions }) => (
  <div>
    <div className="flex items-center group/section">
      <button
        onClick={onToggle}
        className="flex-1 flex items-center gap-1 py-1.5 px-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted hover:text-secondary transition-colors"
        aria-expanded={isExpanded}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 text-muted/60 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>{title}</span>
        <span className="text-muted/50 font-normal">{count}</span>
      </button>
      {extraActions}
      {onAction && (
        <button
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          className="p-1 text-muted/0 group-hover/section:text-muted hover:!text-accent rounded transition-all"
          title={actionLabel || "Add"}
          aria-label={actionLabel || "Add"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
    {isExpanded && <div className="mt-0.5 ml-1">{children}</div>}
  </div>
);
