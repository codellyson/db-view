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

  if (savedConnections.length === 0) {
    return null;
  }

  const currentConnection = savedConnections.find(c => c.id === currentConnectionId);

  const handleSwitch = async (connectionId: string) => {
    if (connectionId === currentConnectionId) {
      setIsOpen(false);
      return;
    }
    try {
      await connectToSaved(connectionId);
      setIsOpen(false);
      addToast('CONNECTION SWITCHED', 'success');
    } catch (err) {
      console.error('Failed to switch connection:', err);
      addToast('FAILED TO SWITCH CONNECTION', 'error');
    }
  };

  const handleDelete = (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation();
    setDeleteTarget(connectionId);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteConnection(deleteTarget);
      addToast('CONNECTION DELETED', 'info');
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
        className="text-sm font-bold uppercase font-mono border-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black border-white dark:border-black hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white"
        disabled={isConnecting}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {currentConnection ? currentConnection.name.toUpperCase() : 'CONNECTIONS'}
        <span className="ml-2" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full right-0 mt-2 z-20 bg-white dark:bg-black border-2 border-black dark:border-white min-w-[200px]" role="listbox" aria-label="Saved connections">
            <div className="p-2 border-b-2 border-black dark:border-white">
              <p className="text-xs font-bold uppercase text-black dark:text-white">SAVED CONNECTIONS</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {savedConnections.map((connection) => (
                <div
                  key={connection.id}
                  role="option"
                  aria-selected={connection.id === currentConnectionId}
                  className={`p-3 border-b-2 border-black dark:border-white cursor-pointer ${
                    connection.id === currentConnectionId
                      ? 'bg-blue-400 text-black'
                      : 'bg-white dark:bg-black text-black dark:text-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'
                  }`}
                  onClick={() => handleSwitch(connection.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold uppercase truncate">
                        {connection.name}
                      </p>
                      <p className="text-xs font-mono truncate">
                        {connection.config.host}:{connection.config.port}/{connection.config.database}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, connection.id)}
                      className="ml-2 px-2 py-1 text-xs font-bold uppercase border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-red-500 hover:text-white hover:border-red-500"
                      aria-label={`Delete connection ${connection.name}`}
                    >
                      ×
                    </button>
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
        title="DELETE CONNECTION"
        message="ARE YOU SURE YOU WANT TO DELETE THIS CONNECTION?"
        confirmText="DELETE"
        variant="danger"
      />
    </div>
  );
};
