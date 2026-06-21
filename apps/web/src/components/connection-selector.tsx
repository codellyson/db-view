
import React, { useState } from 'react';
import { useConnection } from '../contexts/connection-context';
import { useToast } from '../contexts/toast-context';
import { ConfirmDialog } from './ui/confirm-dialog';

interface ConnectionSelectorProps {
  status: 'connected' | 'connecting' | 'disconnected';
  databaseName?: string;
  tableCount?: number;
  latency?: number | null;
  onDisconnect: () => void;
}

const dotColor: Record<ConnectionSelectorProps['status'], string> = {
  connected: 'bg-success',
  connecting: 'bg-warning',
  disconnected: 'bg-muted',
};

export const ConnectionSelector: React.FC<ConnectionSelectorProps> = ({
  status,
  databaseName,
  tableCount,
  latency,
  onDisconnect,
}) => {
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

  const currentConnection = savedConnections.find(c => c.id === currentConnectionId);
  const label = currentConnection?.name ?? databaseName ?? 'Connection';

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
        className="inline-flex items-center gap-2 text-sm font-medium rounded-md border border-border px-3 py-1.5 bg-bg text-primary hover:bg-bg-secondary transition-colors"
        disabled={isConnecting}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[status]} ${
            status === 'connecting' ? 'animate-pulse' : ''
          }`}
        />
        <span className="truncate max-w-[160px]">{label}</span>
        <svg
          className={`w-3.5 h-3.5 text-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => !isConnecting && setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full right-0 mt-2 z-20 bg-bg border border-border rounded-lg shadow-lg min-w-[240px] overflow-hidden" role="menu" aria-label="Connection">
            {status !== 'disconnected' && (
              <div className="px-3 py-2.5 border-b border-border bg-bg-secondary">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[status]}`} />
                  <span className="text-sm font-mono text-primary truncate">
                    {databaseName ?? label}
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-1">
                  {tableCount !== undefined && tableCount > 0 && (
                    <>{tableCount} {tableCount === 1 ? 'table' : 'tables'}</>
                  )}
                  {latency != null && (
                    <>{tableCount ? ' · ' : ''}{latency}ms</>
                  )}
                  {status === 'connecting' && 'Reconnecting…'}
                </p>
              </div>
            )}

            {savedConnections.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-medium text-muted">Saved connections</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {savedConnections.map((connection) => (
                    <div
                      key={connection.id}
                      role="menuitem"
                      aria-current={connection.id === currentConnectionId}
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
                              : `${connection.config.host}:${connection.config.port}/${connection.config.database}`}
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
                            className="ml-2 flex items-center justify-center w-6 h-6 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            aria-label={`Delete connection ${connection.name}`}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l10 10M13 3L3 13" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              role="menuitem"
              onClick={() => { setIsOpen(false); onDisconnect(); }}
              disabled={isConnecting}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-danger border-t border-border hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6M10.5 11l3-3-3-3M13 8H6" />
              </svg>
              Disconnect
            </button>
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
