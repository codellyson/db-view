
import React, { useState } from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { TriangleAlert } from 'lucide-react';
import { Input } from '@codellyson/justui/react';

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
            <TriangleAlert className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
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
            <TriangleAlert className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
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
            <Input
              value={typedValue}
              onChange={setTypedValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isTypedCorrect) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              autoFocus
              placeholder={confirmText}
              containerClassName="w-full"
              className="font-mono placeholder:text-muted/40"
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
