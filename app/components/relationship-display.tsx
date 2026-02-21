'use client';

import React, { useState } from 'react';

interface ForeignKey {
  constraint_name: string;
  source_column: string;
  target_schema: string;
  target_table: string;
  target_column: string;
}

interface Index {
  index_name: string;
  index_type: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
}

interface RelationshipDisplayProps {
  relationships: ForeignKey[];
  indexes: Index[];
  onNavigateToTable?: (table: string) => void;
}

export const RelationshipDisplay: React.FC<RelationshipDisplayProps> = ({
  relationships,
  indexes,
  onNavigateToTable,
}) => {
  const [showRelationships, setShowRelationships] = useState(true);
  const [showIndexes, setShowIndexes] = useState(false);

  if (relationships.length === 0 && indexes.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      {relationships.length > 0 && (
        <div className="border-2 border-black dark:border-white">
          <button
            onClick={() => setShowRelationships(!showRelationships)}
            className="w-full flex items-center justify-between p-4 bg-black dark:bg-white text-white dark:text-black font-bold uppercase font-mono text-sm"
            aria-expanded={showRelationships}
          >
            <span>FOREIGN KEYS ({relationships.length})</span>
            <span>{showRelationships ? '−' : '+'}</span>
          </button>
          {showRelationships && (
            <div className="p-4 space-y-2">
              {relationships.map((fk, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-mono text-black dark:text-white">
                  <span className="font-bold">{fk.source_column}</span>
                  <span className="text-black/40 dark:text-white/40">&rarr;</span>
                  {onNavigateToTable ? (
                    <button
                      onClick={() => onNavigateToTable(fk.target_table)}
                      className="font-bold underline underline-offset-4 hover:text-accent"
                    >
                      {fk.target_table}.{fk.target_column}
                    </button>
                  ) : (
                    <span className="font-bold">{fk.target_table}.{fk.target_column}</span>
                  )}
                  <span className="text-xs text-black/40 dark:text-white/40 ml-2">
                    ({fk.constraint_name})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {indexes.length > 0 && (
        <div className="border-2 border-black dark:border-white">
          <button
            onClick={() => setShowIndexes(!showIndexes)}
            className="w-full flex items-center justify-between p-4 bg-black dark:bg-white text-white dark:text-black font-bold uppercase font-mono text-sm"
            aria-expanded={showIndexes}
          >
            <span>INDEXES ({indexes.length})</span>
            <span>{showIndexes ? '−' : '+'}</span>
          </button>
          {showIndexes && (
            <div className="p-4 space-y-2">
              {indexes.map((idx, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-mono text-black dark:text-white flex-wrap">
                  <span className="font-bold">{idx.index_name}</span>
                  <span className="text-xs px-2 py-0.5 border border-black dark:border-white uppercase">
                    {idx.index_type}
                  </span>
                  {idx.is_primary && (
                    <span className="text-xs px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black uppercase font-bold">
                      PK
                    </span>
                  )}
                  {idx.is_unique && !idx.is_primary && (
                    <span className="text-xs px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black uppercase font-bold">
                      UNIQUE
                    </span>
                  )}
                  <span className="text-black/60 dark:text-white/60">
                    ({idx.columns.join(', ')})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
