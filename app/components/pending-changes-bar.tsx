'use client';

import React from 'react';
import { Button } from './ui/button';
import { usePendingChanges } from '../contexts/pending-changes-context';
import { useDashboard } from '../contexts/dashboard-context';

interface PendingChangesBarProps {
  onOpenReview: () => void;
}

/**
 * Floating action bar shown at the bottom of the viewport when the active
 * table has staged changes. Lets the user discard or review-and-save them.
 * The Review SQL modal lives in the parent so a global Cmd+S hotkey can
 * open it without depending on this bar.
 */
export const PendingChangesBar: React.FC<PendingChangesBarProps> = ({ onOpenReview }) => {
  const pending = usePendingChanges();
  const { selectedSchema, selectedTable } = useDashboard();

  const count = selectedTable ? pending.getCount(selectedSchema, selectedTable) : 0;
  if (!selectedTable || count === 0) return null;

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
          onClick={() => pending.discardTable({ schema: selectedSchema, table: selectedTable })}
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
