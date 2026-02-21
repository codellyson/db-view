'use client';

import React, { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: any;
  column: string;
  onSave: (column: string, newValue: any) => void;
  onCancel: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
  disabled?: boolean;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  column,
  onSave,
  onCancel,
  isEditing,
  onStartEdit,
  disabled = false,
}) => {
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(value === null || value === undefined ? '' : String(value));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(column, editValue === '' ? null : editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onSave(column, editValue === '' ? null : editValue);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onCancel()}
        className="w-full px-2 py-1 text-sm font-mono border border-accent rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
      />
    );
  }

  const displayValue = value !== null && value !== undefined ? String(value) : null;

  return (
    <div
      className={`truncate ${!disabled ? 'cursor-text' : ''}`}
      onDoubleClick={!disabled ? onStartEdit : undefined}
      title={displayValue || 'NULL'}
    >
      {displayValue !== null ? (
        displayValue
      ) : (
        <span className="text-muted italic">NULL</span>
      )}
    </div>
  );
};
