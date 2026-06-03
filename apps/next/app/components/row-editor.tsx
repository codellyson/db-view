'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { ColumnInfo } from '@/types';

interface RowEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (values: Record<string, any>) => void;
  columns: ColumnInfo[];
  isLoading?: boolean;
}

export const RowEditor: React.FC<RowEditorProps> = ({
  isOpen,
  onClose,
  onInsert,
  columns,
  isLoading = false,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setValues({});
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filtered: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      if (val !== '' && val !== undefined) {
        filtered[key] = val;
      }
    }
    if (Object.keys(filtered).length > 0) {
      onInsert(filtered);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Insert row">
      <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto">
        {columns.map((col) => (
          <div key={col.name}>
            <label className="block text-xs font-medium text-primary mb-1">
              <span className="font-mono">{col.name}</span>
              <span className="text-muted ml-2">
                {col.type}
                {col.nullable ? '' : ' NOT NULL'}
                {col.isPrimaryKey ? ' PK' : ''}
                {col.default ? ` DEFAULT ${col.default}` : ''}
              </span>
            </label>
            <input
              type="text"
              value={values[col.name] || ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [col.name]: e.target.value }))
              }
              placeholder={col.default ? `Default: ${col.default}` : col.nullable ? 'NULL' : 'Required'}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm font-mono border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
            />
          </div>
        ))}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading} disabled={isLoading}>
            Insert
          </Button>
        </div>
      </form>
    </Modal>
  );
};
