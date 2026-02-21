'use client';

import React, { useState } from 'react';
import { TableList } from './table-list';
import { SidebarSkeleton } from './skeletons/sidebar-skeleton';

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
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tables: true,
    views: true,
    matviews: true,
    functions: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside className="w-full bg-bg h-screen overflow-y-auto border-r border-border" aria-label="Database sidebar">
      <div className="p-4">
        {schemas && schemas.length > 1 && onSchemaChange && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-secondary mb-1.5">
              Schema
            </label>
            <select
              value={selectedSchema}
              onChange={(e) => onSchemaChange(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer"
              aria-label="Select database schema"
            >
              {schemas.map((schema) => (
                <option key={schema} value={schema}>
                  {schema}
                </option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <div className="space-y-3">
            <SidebarSection
              title="Tables"
              count={tables.length}
              icon="T"
              isExpanded={expandedSections.tables}
              onToggle={() => toggleSection('tables')}
            >
              <TableList
                tables={tables}
                selectedTable={selectedTable}
                onSelect={onTableSelect}
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

            {functions.length > 0 && (
              <SidebarSection
                title="Functions"
                count={functions.length}
                icon="F"
                isExpanded={expandedSections.functions}
                onToggle={() => toggleSection('functions')}
              >
                <div className="space-y-0.5">
                  {functions.map((fn, i) => (
                    <div
                      key={i}
                      className="px-3 py-1.5 text-sm rounded-md hover:bg-bg-secondary"
                    >
                      <div className="font-medium text-primary truncate">{fn.name}</div>
                      <div className="text-xs text-muted font-mono truncate">
                        ({fn.arguments}) &rarr; {fn.return_type}
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
}> = ({ title, count, icon, isExpanded, onToggle, children }) => (
  <div>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-1.5 px-2 text-xs font-medium text-secondary hover:text-primary rounded-md hover:bg-bg-secondary transition-colors"
      aria-expanded={isExpanded}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-muted font-mono text-[10px] w-5">{icon}</span>
        <span>{title}</span>
        <span className="text-muted">({count})</span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-3.5 w-3.5 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
    {isExpanded && <div className="mt-1">{children}</div>}
  </div>
);
