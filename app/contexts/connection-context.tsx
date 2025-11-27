'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DBConfig, SavedConnection } from '@/types';

interface ConnectionContextType {
  isConnected: boolean;
  isConnecting: boolean;
  databaseName?: string;
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

const STORAGE_KEY = 'db-connections';
const CURRENT_CONNECTION_KEY = 'db-current-connection';

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [databaseName, setDatabaseName] = useState<string | undefined>();
  const [currentConnectionId, setCurrentConnectionId] = useState<string | undefined>();
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadSavedConnections();
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && savedConnections.length > 0 && !isConnected) {
      const currentId = localStorage.getItem(CURRENT_CONNECTION_KEY);
      if (currentId) {
        const connection = savedConnections.find(c => c.id === currentId);
        if (connection) {
          connectToSaved(currentId).catch(() => {});
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedConnections.length]);

  const loadSavedConnections = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const connections = JSON.parse(stored) as SavedConnection[];
        setSavedConnections(connections);
      }
    } catch (e) {
      console.error('Failed to load saved connections:', e);
    }
  };

  const saveConnections = (connections: SavedConnection[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
      setSavedConnections(connections);
    } catch (e) {
      console.error('Failed to save connections:', e);
    }
  };

  const connect = async (config: DBConfig, name?: string) => {
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
      
      if (name && typeof window !== 'undefined') {
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const newConnection: SavedConnection = {
          id: connectionId,
          name,
          config,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };
        const updated = [...savedConnections, newConnection];
        saveConnections(updated);
        setCurrentConnectionId(connectionId);
        localStorage.setItem(CURRENT_CONNECTION_KEY, connectionId);
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
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connection.config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Connection failed');
      }

      const data = await response.json();
      setIsConnected(true);
      setDatabaseName(data.database || connection.config.database);
      setCurrentConnectionId(connectionId);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(CURRENT_CONNECTION_KEY, connectionId);
        const updated = savedConnections.map(c => 
          c.id === connectionId 
            ? { ...c, lastUsed: Date.now() }
            : c
        );
        saveConnections(updated);
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
      setCurrentConnectionId(undefined);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CURRENT_CONNECTION_KEY);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Disconnect failed');
    }
  };

  const saveConnection = (name: string, config: DBConfig) => {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newConnection: SavedConnection = {
      id: connectionId,
      name,
      config,
      createdAt: Date.now(),
    };
    const updated = [...savedConnections, newConnection];
    saveConnections(updated);
  };

  const deleteConnection = (connectionId: string) => {
    const updated = savedConnections.filter(c => c.id !== connectionId);
    saveConnections(updated);
    if (currentConnectionId === connectionId) {
      disconnect();
    }
  };

  return (
    <ConnectionContext.Provider
      value={{
        isConnected,
        isConnecting,
        databaseName,
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

