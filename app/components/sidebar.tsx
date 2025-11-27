import React from 'react';
import { TableList } from './table-list';
import { Spinner } from './ui/spinner';

interface SidebarProps {
  tables: string[];
  selectedTable?: string;
  onTableSelect: (table: string) => void;
  isLoading?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  tables,
  selectedTable,
  onTableSelect,
  isLoading = false,
}) => {
  return (
    <aside className="w-full bg-white h-screen overflow-y-auto">
      <div className="p-8">
        <h2 className="text-xl font-bold uppercase text-black mb-8">
          TABLES
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <TableList
            tables={tables}
            selectedTable={selectedTable}
            onSelect={onTableSelect}
          />
        )}
      </div>
    </aside>
  );
};

