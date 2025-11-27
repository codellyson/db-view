'use client';

import React from 'react';
import { useConnection } from '../contexts/connection-context';
import { Button } from './ui/button';
import { Card } from './ui/card';

export const SavedConnections: React.FC = () => {
  const {
    savedConnections,
    currentConnectionId,
    connectToSaved,
    deleteConnection,
    isConnecting,
  } = useConnection();

  if (savedConnections.length === 0) {
    return null;
  }

  const handleConnect = async (connectionId: string) => {
    try {
      await connectToSaved(connectionId);
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleDelete = (connectionId: string) => {
    if (confirm('DELETE THIS CONNECTION?')) {
      deleteConnection(connectionId);
    }
  };

  return (
    <Card title="SAVED CONNECTIONS" className="mb-8">
      <div className="space-y-2">
        {savedConnections.map((connection) => (
          <div
            key={connection.id}
            className={`p-4 border-2 ${
              connection.id === currentConnectionId
                ? 'bg-blue-400 text-black border-blue-400'
                : 'bg-white text-black border-black'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold uppercase truncate mb-1">
                  {connection.name}
                </p>
                <p className="text-sm font-mono truncate">
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
                    CONNECT
                  </Button>
                )}
                <button
                  onClick={() => handleDelete(connection.id)}
                  className="px-3 py-2 text-sm font-bold uppercase border-2 border-black bg-white text-black hover:bg-red-500 hover:text-white hover:border-red-500"
                  disabled={isConnecting}
                >
                  DELETE
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

