import React, { useState } from 'react';

interface TableListProps {
  tables: string[];
  selectedTable?: string;
  onSelect: (table: string) => void;
}

export const TableList: React.FC<TableListProps> = ({
  tables,
  selectedTable,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTables = tables.filter((table) =>
    table.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Search tables..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 mb-3 text-sm border border-border rounded-md bg-bg text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
        aria-label="Search tables"
      />
      <ul className="space-y-0.5" role="listbox" aria-label="Tables">
        {filteredTables.map((table) => (
          <li key={table} role="option" aria-selected={selectedTable === table}>
            <button
              onClick={() => onSelect(table)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md truncate transition-colors ${
                selectedTable === table
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-primary hover:bg-bg-secondary'
              }`}
              title={table}
            >
              {table}
            </button>
          </li>
        ))}
        {filteredTables.length === 0 && (
          <li className="text-sm text-muted px-3 py-2">No tables found</li>
        )}
      </ul>
      <div className="mt-6 pt-3 border-t border-border">
        <p className="text-xs text-muted">
          {tables.length} {tables.length === 1 ? 'table' : 'tables'}
        </p>
      </div>
    </div>
  );
};
