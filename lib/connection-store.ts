import { DBConfig } from "@/types";

interface StoredConnection {
  config: DBConfig;
  timestamp: number;
}

const connections = new Map<string, StoredConnection>();

export function storeConnection(sessionId: string, config: DBConfig): void {
  connections.set(sessionId, {
    config,
    timestamp: Date.now(),
  });
  console.log(`Connection stored for session: ${sessionId}`);
}

export function getConnection(sessionId: string): DBConfig | null {
  const connection = connections.get(sessionId);
  if (!connection) {
    return null;
  }

  const maxAge = 24 * 60 * 60 * 1000;
  if (Date.now() - connection.timestamp > maxAge) {
    connections.delete(sessionId);
    return null;
  }

  return connection.config;
}

export function removeConnection(sessionId: string): void {
  connections.delete(sessionId);
  console.log(`Connection removed for session: ${sessionId}`);
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
