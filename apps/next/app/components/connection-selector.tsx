'use client';

import React, { useState } from 'react';
import { useConnection } from '../contexts/connection-context';
import { useToast } from '../contexts/toast-context';
import { ConfirmDialog } from './ui/confirm-dialog';

export const ConnectionSelector: React.FC = () => {
  const {
    savedConnections,
    currentConnectionId,
    connectToSaved,
    deleteConnection,
    isConnecting,
  } = useConnection();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  if (savedConnections.length === 0) {
    return null;
  }

  const currentConnection = savedConnections.find(c => c.id === currentConnectionId);

  const handleSwitch = async (connectionId: string) => {
    if (connectionId === currentConnectionId) {
      setIsOpen(false);
      return;
    }
    setSwitchingTo(connectionId);
    try {
      await connectToSaved(connectionId);
      setIsOpen(false);
      addToast('Connection switched', 'success');
    } catch (err) {
      console.error('Failed to switch connection:', err);
      addToast('Failed to switch connection', 'error');
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation();
    setDeleteTarget(connectionId);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteConnection(deleteTarget);
      addToast('Connection deleted', 'info');
      setDeleteTarget(null);
    }
  };

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isOpen) {
          setIsOpen(false);
        }
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm font-medium rounded-md border border-border px-3 py-1.5 bg-bg text-primary hover:bg-bg-secondary transition-colors"
        disabled={isConnecting}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {currentConnection ? currentConnection.name : 'Connections'}
        <span className="ml-2 text-muted" aria-hidden="true">{isOpen ? '\u25b2' : '\u25bc'}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => !isConnecting && setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full right-0 mt-2 z-20 bg-bg border border-border rounded-lg shadow-lg min-w-[220px] overflow-hidden" role="listbox" aria-label="Saved connections">
            <div className="px-3 py-2 border-b border-border bg-bg-secondary">
              <p className="text-xs font-medium text-muted">Saved connections</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {savedConnections.map((connection) => (
                <div
                  key={connection.id}
                  role="option"
                  aria-selected={connection.id === currentConnectionId}
                  className={`px-3 py-2.5 border-b border-border last:border-b-0 cursor-pointer transition-colors ${
                    connection.id === currentConnectionId
                      ? 'bg-accent/10 text-accent'
                      : 'text-primary hover:bg-bg-secondary'
                  }`}
                  onClick={() => !isConnecting && handleSwitch(connection.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {connection.name}
                      </p>
                      <p className="text-xs font-mono text-muted truncate">
                        {isConnecting && switchingTo === connection.id
                          ? 'Connecting...'
                          : `${connection.config.host}:{connection.config.port}/{connection.config.database}`}
                      </p>
                    </div>
                    {isConnecting && switchingTo === connection.id ? (
                      <svg className="ml-2 h-4 w-4 animate-spin text-accent flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <button
                        onClick={(e) => handleDelete(e, connection.id)}
                        className="ml-2 px-1.5 py-0.5 text-xs rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        aria-label={`Delete connection ${connection.name}`}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete connection"
        message="Are you sure you want to delete this connection?"
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};
