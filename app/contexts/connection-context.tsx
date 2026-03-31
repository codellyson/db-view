'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DBConfig, SavedConnection } from '@/types';
import { api } from '@/lib/api';

interface ConnectionContextType {
  isConnected: boolean;
  isConnecting: boolean;
  databaseName?: string;
  databaseType: "postgresql" | "mysql" | "sqlite";
  currentConnectionId?: string;
  savedConnections: SavedConnection[];
  connect: (config: DBConfig, name?: string) => Promise<void>;
  connectToSaved: (connectionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  saveConnection: (name: string, config: DBConfig) => void;
  deleteConnection: (connectionId: string) => void;
  error: string | null;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

const CURRENT_CONNECTION_KEY = 'db-current-connection';

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [databaseName, setDatabaseName] = useState<string | undefined>();
  const [currentConnectionId, setCurrentConnectionId] = useState<string | undefined>();
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [databaseType, setDatabaseType] = useState<"postgresql" | "mysql" | "sqlite">("postgresql");
  const [error, setError] = useState<string | null>(null);

  const loadSavedConnections = useCallback(async () => {
    try {
      const data = await api.get<{ connections: SavedConnection[] }>('/api/saved-connections');
      setSavedConnections(data.connections);
    } catch (e) {
      console.error('Failed to load saved connections:', e);
    }
  }, []);

  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  useEffect(() => {
    if (savedConnections.length > 0 && !isConnected) {
      const currentId = typeof window !== 'undefined'
        ? localStorage.getItem(CURRENT_CONNECTION_KEY)
        : null;
      if (currentId) {
        const connection = savedConnections.find(c => c.id === currentId);
        if (connection) {
          connectToSaved(currentId).catch(() => {});
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedConnections.length]);

  const connect = async (config: DBConfig, name?: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      const connectionId = name
        ? `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`
        : undefined;

      // Single request: connects + optionally saves credentials in encrypted HTTP-only cookie
      const data = await api.post('/api/connect', {
        config,
        ...(name && { saveName: name, saveId: connectionId }),
      }, { noRetry: true });

      setIsConnected(true);
      setDatabaseName(data.database || config.database);
      setDatabaseType(data.type || config.type || "postgresql");

      if (name && data.savedConnection) {
        setSavedConnections(prev => [...prev, data.savedConnection]);
        setCurrentConnectionId(connectionId);
        localStorage.setItem(CURRENT_CONNECTION_KEY, connectionId!);
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

  const connectToSaved = async (connectionId: string) => {
    const connection = savedConnections.find(c => c.id === connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    setIsConnecting(true);
    setError(null);
    try {
      // Server reads credentials from encrypted cookie and connects
      const data = await api.patch('/api/saved-connections', { id: connectionId }, { noRetry: true });
      setIsConnected(true);
      setDatabaseName(data.database || connection.config.database);
      setDatabaseType(data.type || connection.config.type || "postgresql");
      setCurrentConnectionId(connectionId);
      localStorage.setItem(CURRENT_CONNECTION_KEY, connectionId);

      setSavedConnections(prev =>
        prev.map(c =>
          c.id === connectionId ? { ...c, lastUsed: Date.now() } : c
        )
      );
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
      await api.post('/api/disconnect', undefined, { noRetry: true });
      setIsConnected(false);
      setDatabaseName(undefined);
      setDatabaseType("postgresql");
      setCurrentConnectionId(undefined);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CURRENT_CONNECTION_KEY);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Disconnect failed');
    }
  };

  const saveConnection = async (name: string, config: DBConfig) => {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    try {
      const data = await api.post('/api/saved-connections', {
        id: connectionId,
        name,
        config,
      }, { noRetry: true });
      setSavedConnections(prev => [...prev, data.connection]);
    } catch (e) {
      console.error('Failed to save connection:', e);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      await api.delete('/api/saved-connections', { id: connectionId });
      setSavedConnections(prev => prev.filter(c => c.id !== connectionId));
      if (currentConnectionId === connectionId) {
        disconnect();
      }
    } catch (e) {
      console.error('Failed to delete connection:', e);
    }
  };

  return (
    <ConnectionContext.Provider
      value={{
        isConnected,
        isConnecting,
        databaseName,
        databaseType,
        currentConnectionId,
        savedConnections,
        connect,
        connectToSaved,
        disconnect,
        saveConnection,
        deleteConnection,
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

