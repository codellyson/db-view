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
      color: 'bg-green-400 text-black border-green-400',
      text: 'CONNECTED',
    },
    disconnected: {
      color: 'bg-white dark:bg-black text-black dark:text-white border-black dark:border-white',
      text: 'DISCONNECTED',
    },
    connecting: {
      color: 'bg-yellow-300 text-black border-yellow-300',
      text: 'CONNECTING',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`px-3 py-1 border-2 rounded-none text-xs font-bold uppercase font-mono ${config.color}`}>
        {status === 'connecting' ? (
          <span className="animate-pulse">{config.text}</span>
        ) : (
          <>
            {config.text}
            {status === 'connected' && databaseName && `: ${databaseName.toUpperCase()}`}
            {status === 'connected' && latency != null && ` [${latency}MS]`}
          </>
        )}
      </span>
    </div>
  );
};

