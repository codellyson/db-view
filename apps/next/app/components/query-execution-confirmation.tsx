'use client';

import React, { useState } from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';

interface QueryExecutionConfirmationProps {
  isOpen: boolean;
  sql: string;
  statement: string;
  kind: 'write' | 'ddl';
  isBulkWrite: boolean;
  requiresTypedConfirmation: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const kindColors: Record<string, string> = {
  write: 'text-warning',
  ddl: 'text-danger',
};

const statementColors: Record<string, string> = {
  DELETE: 'text-danger',
  DROP: 'text-danger',
  TRUNCATE: 'text-danger',
  UPDATE: 'text-warning',
  INSERT: 'text-success',
  CREATE: 'text-accent',
  ALTER: 'text-warning',
  RENAME: 'text-warning',
};

export const QueryExecutionConfirmation: React.FC<QueryExecutionConfirmationProps> = ({
  isOpen,
  sql,
  statement,
  kind,
  isBulkWrite,
  requiresTypedConfirmation,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [typedValue, setTypedValue] = useState('');
  const confirmText = statement.toUpperCase();
  const isTypedCorrect = typedValue.trim().toUpperCase() === confirmText;
  const isDangerous = kind === 'ddl' || isBulkWrite;

  const handleConfirm = () => {
    if (requiresTypedConfirmation && !isTypedCorrect) return;
    onConfirm();
    setTypedValue('');
  };

  const handleCancel = () => {
    setTypedValue('');
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={`Confirm ${statement}`}
      preventClose={isLoading}
    >
      <div className="space-y-4">
        {isBulkWrite && (
          <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-danger">No WHERE clause detected</p>
              <p className="text-xs text-danger/80 mt-0.5">
                This will affect <strong>every row</strong> in the table.
              </p>
            </div>
          </div>
        )}

        {kind === 'ddl' && (
          <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-danger">Schema modification</p>
              <p className="text-xs text-danger/80 mt-0.5">
                This will modify the database structure.
              </p>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-secondary mb-2">
            The following SQL will be executed:
          </p>
          <pre className="p-3 bg-bg-secondary border border-border rounded-md text-sm font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-48">
            <span className={statementColors[statement] || kindColors[kind] || 'text-primary'}>
              {sql}
            </span>
          </pre>
        </div>

        {requiresTypedConfirmation && (
          <div>
            <p className="text-sm text-secondary mb-2">
              Type <strong className="font-mono text-primary">{confirmText}</strong> to confirm:
            </p>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isTypedCorrect) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              autoFocus
              placeholder={confirmText}
              className="w-full px-3 py-2 text-sm font-mono border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted/40"
              spellCheck={false}
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={isLoading || (requiresTypedConfirmation && !isTypedCorrect)}
            className={isDangerous ? 'bg-danger border-danger hover:bg-danger/90' : ''}
          >
            Execute {statement}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
