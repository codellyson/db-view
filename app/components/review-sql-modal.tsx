'use client';

import React, { useMemo, useState } from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { useConnection } from '../contexts/connection-context';
import { useToast } from '../contexts/toast-context';
import { usePendingChanges } from '../contexts/pending-changes-context';
import { useDashboard } from '../contexts/dashboard-context';
import { buildDisplaySQL, type MutationRequest } from '@/lib/mutation';
import { api } from '@/lib/api';

interface ReviewSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: string;
  table: string;
}

const typeColor: Record<MutationRequest['type'], string> = {
  INSERT: 'text-success',
  UPDATE: 'text-warning',
  DELETE: 'text-danger',
};

export const ReviewSqlModal: React.FC<ReviewSqlModalProps> = ({
  isOpen,
  onClose,
  schema,
  table,
}) => {
  const { databaseType } = useConnection();
  const { addToast } = useToast();
  const pending = usePendingChanges();
  const { refreshTableData } = useDashboard();
  const [isSaving, setIsSaving] = useState(false);

  // Recompute on every open. Cheap; avoids stale state if the user opens,
  // makes more edits, and reopens.
  const requests = useMemo(
    () => (isOpen ? pending.buildMutationRequests({ schema, table }) : []),
    [isOpen, pending, schema, table]
  );

  const counts = useMemo(() => {
    const result = { INSERT: 0, UPDATE: 0, DELETE: 0 };
    for (const r of requests) result[r.type]++;
    return result;
  }, [requests]);

  const handleSave = async () => {
    if (requests.length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/api/mutate-batch', { changes: requests }, { noRetry: true });
      pending.clearAfterSave({ schema, table });
      await refreshTableData();
      addToast(
        `Saved ${requests.length} ${requests.length === 1 ? 'change' : 'changes'}`,
        'success'
      );
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Save failed — all changes rolled back', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review SQL" preventClose={isSaving}>
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-xs text-secondary">
          <span>{requests.length} statement{requests.length === 1 ? '' : 's'}</span>
          {counts.INSERT > 0 && (
            <span className="text-success">{counts.INSERT} insert{counts.INSERT === 1 ? '' : 's'}</span>
          )}
          {counts.UPDATE > 0 && (
            <span className="text-warning">{counts.UPDATE} update{counts.UPDATE === 1 ? '' : 's'}</span>
          )}
          {counts.DELETE > 0 && (
            <span className="text-danger">{counts.DELETE} delete{counts.DELETE === 1 ? '' : 's'}</span>
          )}
          <span className="text-muted ml-auto">runs in a single transaction</span>
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-border">
            {requests.length === 0 ? (
              <div className="p-4 text-sm text-muted text-center">No pending changes.</div>
            ) : (
              requests.map((r, i) => (
                <pre
                  key={i}
                  className="p-3 text-xs font-mono whitespace-pre-wrap break-all bg-bg-secondary/30"
                >
                  <span className={typeColor[r.type]}>{buildDisplaySQL(r, databaseType)};</span>
                </pre>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isSaving || requests.length === 0}
          >
            Save {requests.length > 0 ? `(${requests.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
