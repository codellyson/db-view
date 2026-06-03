'use client';

import React from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';

interface MutationConfirmationProps {
  isOpen: boolean;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  sql: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const MutationConfirmation: React.FC<MutationConfirmationProps> = ({
  isOpen,
  type,
  sql,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const typeColors: Record<string, string> = {
    INSERT: 'text-success',
    UPDATE: 'text-warning',
    DELETE: 'text-danger',
  };

  const typeLabels: Record<string, string> = {
    INSERT: 'Insert',
    UPDATE: 'Update',
    DELETE: 'Delete',
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={`Confirm ${typeLabels[type] || type}`} preventClose={isLoading}>
      <div className="space-y-4">
        <p className="text-sm text-secondary">
          The following SQL will be executed:
        </p>
        <pre className="p-4 bg-bg-secondary border border-border rounded-md text-sm font-mono text-primary whitespace-pre-wrap break-all overflow-x-auto max-h-48">
          <span className={typeColors[type] || ''}>{sql}</span>
        </pre>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={type === 'DELETE' ? 'primary' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={isLoading}
            className={type === 'DELETE' ? 'bg-danger border-danger hover:bg-danger/90' : ''}
          >
            {typeLabels[type] || type}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
