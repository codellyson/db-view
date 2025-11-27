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
        className="w-full px-4 py-3 mb-4 text-sm border-2 border-black rounded-none font-mono focus:outline-none focus:shadow-[0_0_0_2px_black] bg-white text-black"
      />
      <ul className="space-y-2">
        {filteredTables.map((table) => (
          <li key={table}>
            <button
              onClick={() => onSelect(table)}
              className={`w-full text-left px-4 py-3 text-sm border-2 rounded-none font-mono uppercase font-bold truncate ${
                selectedTable === table
                  ? 'bg-blue-400 text-black border-blue-400'
                  : 'bg-white text-black border-black hover:bg-black hover:text-white'
              }`}
              title={table}
            >
              {table}
            </button>
          </li>
        ))}
        {filteredTables.length === 0 && (
          <li className="text-sm font-bold uppercase text-black px-4 py-3 border-2 border-black">NO TABLES FOUND</li>
        )}
      </ul>
      <div className="mt-8 pt-4 border-t-2 border-black">
        <p className="text-xs font-bold uppercase text-black">
          {tables.length} {tables.length === 1 ? 'TABLE' : 'TABLES'}
        </p>
      </div>
    </div>
  );
};

