import React from 'react';

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting';
  databaseName?: string;
  latency?: number | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  databaseName,
  latency,
}) => {
  const statusConfig = {
    connected: {
      dotColor: 'bg-success',
      badgeClass: 'bg-success/10 text-success',
      text: 'Connected',
    },
    disconnected: {
      dotColor: 'bg-muted',
      badgeClass: 'bg-bg-secondary text-secondary',
      text: 'Disconnected',
    },
    connecting: {
      dotColor: 'bg-warning',
      badgeClass: 'bg-warning/10 text-warning',
      text: 'Connecting',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.badgeClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
        {status === 'connecting' ? (
          <span>{config.text}</span>
        ) : (
          <>
            {config.text}
            {status === 'connected' && databaseName && `: ${databaseName}`}
            {status === 'connected' && latency != null && ` (${latency}ms)`}
          </>
        )}
      </span>
    </div>
  );
};
