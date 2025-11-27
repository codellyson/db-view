'use client';

import React, { useState } from 'react';
import { useConnection } from '../contexts/connection-context';
import { Button } from './ui/button';

export const ConnectionSelector: React.FC = () => {
  const {
    savedConnections,
    currentConnectionId,
    connectToSaved,
    deleteConnection,
    isConnecting,
  } = useConnection();
  const [isOpen, setIsOpen] = useState(false);

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
    } catch (err) {
      console.error('Failed to switch connection:', err);
    }
  };

  const handleDelete = (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation();
    if (confirm('DELETE THIS CONNECTION?')) {
      deleteConnection(connectionId);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm font-bold uppercase font-mono border-2 px-4 py-2 bg-black text-white border-white hover:bg-white hover:text-black"
        disabled={isConnecting}
      >
        {currentConnection ? currentConnection.name.toUpperCase() : 'CONNECTIONS'}
        <span className="ml-2">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 z-20 bg-white border-2 border-black min-w-[200px]">
            <div className="p-2 border-b-2 border-black">
              <p className="text-xs font-bold uppercase text-black">SAVED CONNECTIONS</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {savedConnections.map((connection) => (
                <div
                  key={connection.id}
                  className={`p-3 border-b-2 border-black cursor-pointer ${
                    connection.id === currentConnectionId
                      ? 'bg-blue-400 text-black'
                      : 'bg-white text-black hover:bg-black hover:text-white'
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
                      className="ml-2 px-2 py-1 text-xs font-bold uppercase border-2 border-black bg-white text-black hover:bg-red-500 hover:text-white hover:border-red-500"
                      title="Delete connection"
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
    </div>
  );
};

