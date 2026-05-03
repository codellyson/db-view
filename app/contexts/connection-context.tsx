'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DBConfig, SavedConnection } from '@/types';
import { api } from '@/lib/api';
import { useToast } from './toast-context';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 5_000;
const ACTIVITY_CHANNEL = 'justdb-activity';
const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'visibilitychange',
];

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
  const { addToast } = useToast();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);

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

  const disconnect = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!isConnected) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(ACTIVITY_CHANNEL)
        : null;

    const arm = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        void disconnect();
        addToast('Disconnected after 30 minutes of inactivity', 'info');
      }, IDLE_TIMEOUT_MS);
    };

    const noteActivity = (broadcast: boolean) => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      arm();
      if (broadcast && channel) channel.postMessage({ t: now });
    };

    lastActivityRef.current = Date.now();
    arm();

    const onLocalActivity = () => noteActivity(true);
    const onRemoteActivity = () => noteActivity(false);

    ACTIVITY_EVENTS.forEach((ev) =>
      document.addEventListener(ev, onLocalActivity, { passive: true })
    );
    if (channel) channel.addEventListener('message', onRemoteActivity);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onLocalActivity));
      if (channel) {
        channel.removeEventListener('message', onRemoteActivity);
        channel.close();
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [isConnected, disconnect, addToast]);

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

