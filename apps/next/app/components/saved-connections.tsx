'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection } from '../contexts/connection-context';
import { useToast } from '../contexts/toast-context';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ConfirmDialog } from './ui/confirm-dialog';

export const SavedConnections: React.FC = () => {
  const {
    savedConnections,
    currentConnectionId,
    connectToSaved,
    deleteConnection,
    isConnecting,
  } = useConnection();
  const { addToast } = useToast();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (savedConnections.length === 0) {
    return null;
  }

  const handleConnect = async (connectionId: string) => {
    try {
      await connectToSaved(connectionId);
      addToast('Connected successfully', 'success');
      router.push('/');
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleDelete = (connectionId: string) => {
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
    <Card title="Saved connections" className="mb-8">
      <div className="space-y-2">
        {savedConnections.map((connection) => (
          <div
            key={connection.id}
            className={`p-4 border rounded-md transition-colors ${
              connection.id === currentConnectionId
                ? 'bg-accent/10 border-accent text-primary'
                : 'bg-bg border-border text-primary hover:bg-bg-secondary'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate mb-0.5">
                  {connection.name}
                </p>
                <p className="text-xs font-mono text-muted truncate">
                  {connection.config.host}:{connection.config.port}/{connection.config.database}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {connection.id !== currentConnectionId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleConnect(connection.id)}
                    disabled={isConnecting}
                  >
                    Connect
                  </Button>
                )}
                <button
                  onClick={() => handleDelete(connection.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-secondary hover:bg-danger/10 hover:text-danger hover:border-danger transition-colors"
                  disabled={isConnecting}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete connection"
        message="Are you sure you want to delete this connection? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </Card>
  );
};
