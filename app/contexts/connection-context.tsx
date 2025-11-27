'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DBConfig } from '@/types';

interface ConnectionContextType {
  isConnected: boolean;
  isConnecting: boolean;
  databaseName?: string;
  connect: (config: DBConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [databaseName, setDatabaseName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('db-connection');
      if (stored) {
        try {
          const config = JSON.parse(stored);
          connect(config).catch(() => {});
        } catch (e) {
          localStorage.removeItem('db-connection');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async (config: DBConfig) => {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Connection failed');
      }

      const data = await response.json();
      setIsConnected(true);
      setDatabaseName(data.database || config.database);
      if (typeof window !== 'undefined') {
        localStorage.setItem('db-connection', JSON.stringify(config));
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed');
      setIsConnected(false);
      setDatabaseName(undefined);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await fetch('/api/disconnect', { method: 'POST' });
      setIsConnected(false);
      setDatabaseName(undefined);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('db-connection');
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Disconnect failed');
    }
  };

  return (
    <ConnectionContext.Provider
      value={{
        isConnected,
        isConnecting,
        databaseName,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}

