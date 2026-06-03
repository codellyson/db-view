'use client';

import React from 'react';
import { Button } from './ui/button';
import { usePendingChanges } from '../contexts/pending-changes-context';

interface PendingChangesBarProps {
  onOpenReview: () => void;
  target: { schema: string; table: string } | null;
}

export const PendingChangesBar: React.FC<PendingChangesBarProps> = ({ onOpenReview, target }) => {
  const pending = usePendingChanges();

  const count = target ? pending.getCount(target.schema, target.table) : 0;
  if (!target || count === 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-bg border border-border rounded-lg shadow-lg shadow-black/20"
    >
      <span className="text-sm text-primary font-medium">
        {count} {count === 1 ? 'change' : 'changes'} pending
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => pending.discardTable({ schema: target.schema, table: target.table })}
        >
          Discard
        </Button>
        <Button variant="secondary" size="sm" onClick={onOpenReview}>
          Review SQL
        </Button>
        <Button variant="primary" size="sm" onClick={onOpenReview}>
          Save
        </Button>
      </div>
    </div>
  );
};
