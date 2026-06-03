import React from 'react';

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting';
  databaseName?: string;
  latency?: number | null;
  /** Total tables in the active schema; used as a quick liveness signal. */
  tableCount?: number;
  /** When set, the pill becomes a button that opens connection details. */
  onClick?: () => void;
}

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
    text: 'Reconnecting',
  },
} as const;

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  databaseName,
  latency,
  tableCount,
  onClick,
}) => {
  const config = statusConfig[status];

  // When connected, show database, latency, and table count as separate
  // signals rather than a single redundant "Connected" label. The doc:
  // "you already see data — replace with something useful."
  const Element = onClick ? 'button' : 'span';
  const className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.badgeClass} ${
    onClick ? 'hover:brightness-110 transition' : ''
  }`;

  return (
    <div className="flex items-center gap-2">
      <Element
        className={className}
        onClick={onClick}
        title={onClick ? 'Open connection details' : undefined}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${
            status === 'connecting' ? 'animate-pulse' : ''
          }`}
        />
        {status !== 'connected' ? (
          <span>{config.text}</span>
        ) : (
          <>
            {databaseName && <span className="font-mono">{databaseName}</span>}
            {tableCount !== undefined && tableCount > 0 && (
              <span className="text-muted">· {tableCount} {tableCount === 1 ? 'table' : 'tables'}</span>
            )}
            {latency != null && (
              <span className="text-muted">· {latency}ms</span>
            )}
          </>
        )}
      </Element>
    </div>
  );
};
