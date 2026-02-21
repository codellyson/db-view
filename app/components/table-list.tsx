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
        placeholder="SEARCH..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-3 mb-4 text-sm border-2 border-black dark:border-white rounded-none font-mono focus:outline-none focus:shadow-[0_0_0_2px_black] dark:focus:shadow-[0_0_0_2px_white] bg-white dark:bg-black text-black dark:text-white"
        aria-label="Search tables"
      />
      <ul className="space-y-2" role="listbox" aria-label="Tables">
        {filteredTables.map((table) => (
          <li key={table} role="option" aria-selected={selectedTable === table}>
            <button
              onClick={() => onSelect(table)}
              className={`w-full text-left px-4 py-3 text-sm border-2 rounded-none font-mono uppercase font-bold truncate ${
                selectedTable === table
                  ? 'bg-accent text-black border-accent'
                  : 'bg-white dark:bg-black text-black dark:text-white border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'
              }`}
              title={table}
            >
              {table}
            </button>
          </li>
        ))}
        {filteredTables.length === 0 && (
          <li className="text-sm font-bold uppercase text-black dark:text-white px-4 py-3 border-2 border-black dark:border-white">NO TABLES FOUND</li>
        )}
      </ul>
      <div className="mt-8 pt-4 border-t-2 border-black dark:border-white">
        <p className="text-xs font-bold uppercase text-black dark:text-white">
          {tables.length} {tables.length === 1 ? 'TABLE' : 'TABLES'}
        </p>
      </div>
    </div>
  );
};
