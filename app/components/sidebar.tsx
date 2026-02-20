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
    <aside className="w-full bg-white dark:bg-black h-screen overflow-y-auto" aria-label="Database sidebar">
      <div className="p-8">
        {schemas && schemas.length > 1 && onSchemaChange && (
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase text-black dark:text-white mb-2 font-mono">
              SCHEMA
            </label>
            <select
              value={selectedSchema}
              onChange={(e) => onSchemaChange(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold uppercase font-mono border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:shadow-[0_0_0_2px_black] dark:focus:shadow-[0_0_0_2px_white] appearance-none cursor-pointer"
              aria-label="Select database schema"
            >
              {schemas.map((schema) => (
                <option key={schema} value={schema}>
                  {schema.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <div className="space-y-4">
            <SidebarSection
              title={`[T] TABLES (${tables.length})`}
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
                title={`[V] VIEWS (${views.length})`}
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
                title={`[MV] MAT. VIEWS (${materializedViews.length})`}
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
                title={`[F] FUNCTIONS (${functions.length})`}
                isExpanded={expandedSections.functions}
                onToggle={() => toggleSection('functions')}
              >
                <div className="space-y-1">
                  {functions.map((fn, i) => (
                    <div
                      key={i}
                      className="px-4 py-2 text-sm font-mono text-black dark:text-white border-b border-black/10 dark:border-white/10 last:border-b-0"
                    >
                      <div className="font-bold truncate">{fn.name}</div>
                      <div className="text-xs text-black/60 dark:text-white/60 truncate">
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
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, isExpanded, onToggle, children }) => (
  <div>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-sm font-bold uppercase text-black dark:text-white font-mono hover:bg-black/5 dark:hover:bg-white/5 px-2"
      aria-expanded={isExpanded}
    >
      <span>{title}</span>
      <span>{isExpanded ? '\u2212' : '+'}</span>
    </button>
    {isExpanded && <div className="mt-1">{children}</div>}
  </div>
);
