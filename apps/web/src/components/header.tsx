
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectionSelector } from './connection-selector';
import { useConnection } from '../contexts/connection-context';
import { useConnectionHealth } from '../hooks/use-connection-health';
import { CircleHelp, Menu, PanelLeft, PanelLeftClose, Settings, TriangleAlert } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  databaseName?: string;
  tableCount?: number;
  onMenuToggle?: () => void;
  onShortcutsHelp?: () => void;
  onOpenSettings?: () => void;
  /** Desktop sidebar dock: current open state + toggle. */
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  databaseName,
  tableCount,
  onMenuToggle,
  onShortcutsHelp,
  onOpenSettings,
  sidebarOpen = true,
  onToggleSidebar,
}) => {
  const navigate = useNavigate();
  const { disconnect } = useConnection();
  const { latency, healthy } = useConnectionHealth(isConnected);

  const handleDisconnect = async () => {
    // No explicit navigate after disconnect — Home swaps the rendered
    // view from Dashboard to the Connections landing the moment
    // isConnected flips, so we don't need to push a new route.
    await disconnect();
  };

  const handleReconnect = () => {
    // Force a re-poll by routing back to root which performs a connection
    // restore via the existing flow, then back to the dashboard.
    navigate('/');
  };

  return (
    <>
    {isConnected && !healthy && (
      <div role="alert" className="bg-danger/10 border-b border-danger/30 text-danger px-4 py-2 flex items-center gap-3">
        <TriangleAlert className="h-4 w-4 flex-shrink-0" />
        <span className="text-xs font-medium">Connection lost. Recent operations may have failed.</span>
        <button
          onClick={handleReconnect}
          className="ml-auto px-2 py-0.5 text-xs font-medium bg-danger/20 hover:bg-danger/30 rounded-sm transition-colors"
        >
          Reconnect
        </button>
      </div>
    )}
    <header
      className="h-12 bg-bg border-b border-border flex items-center justify-between pl-3 pr-4 md:pr-6"
    >
      <div
        className="flex items-center gap-2 md:gap-3"
      >
        {isConnected && onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {isConnected && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-pressed={sidebarOpen}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
        )}
        {isConnected ? (
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-bg-secondary transition-colors"
            aria-label="Back to tables"
          >
            <img
              src="/logo.svg"
              alt="JustDB"
              width={28}
              height={28}
            />
            <span className="text-base font-semibold text-primary">JustDB</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt="JustDB"
              width={28}
              height={28}
            />
            <span className="text-base font-semibold text-primary">JustDB</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {isConnected && (
          <span className="hidden sm:block">
            <ConnectionSelector
              status={healthy ? 'connected' : 'connecting'}
              databaseName={databaseName}
              tableCount={tableCount}
              latency={latency}
              onDisconnect={handleDisconnect}
            />
          </span>
        )}
        {isConnected && onShortcutsHelp && (
          <button
            onClick={onShortcutsHelp}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            title="Keyboard shortcuts"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
    </>
  );
};
