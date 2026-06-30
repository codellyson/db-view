
import React from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useNavigate } from 'react-router-dom';
import { ConnectionSelector } from './connection-selector';
import { useConnection } from '../contexts/connection-context';
import { useConnectionHealth } from '../hooks/use-connection-health';
import { isMacOSTauri } from '../lib/runtime';

interface HeaderProps {
  isConnected: boolean;
  databaseName?: string;
  tableCount?: number;
  onMenuToggle?: () => void;
  onShortcutsHelp?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  databaseName,
  tableCount,
  onMenuToggle,
  onShortcutsHelp,
  onOpenSettings,
}) => {
  const navigate = useNavigate();
  const { disconnect } = useConnection();
  const { latency, healthy } = useConnectionHealth(isConnected);
  const onMac = isMacOSTauri();
  const [version, setVersion] = React.useState('');
  React.useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);

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
        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-medium">Connection lost. Recent operations may have failed.</span>
        <button
          onClick={handleReconnect}
          className="ml-auto px-2 py-0.5 text-xs font-medium bg-danger/20 hover:bg-danger/30 rounded transition-colors"
        >
          Reconnect
        </button>
      </div>
    )}
    <header
      // The macOS overlay title bar reserves the top-left ~60px for traffic
      // lights. We only need to clear them when the Header is rendered at
      // the left edge of the window — i.e. on the pre-connection screens
      // before the sidebar appears. Once connected, the sidebar sits left
      // of the Header and absorbs the traffic-light zone, so the Header
      // can align flush with the TabBar below.
      data-tauri-drag-region={onMac ? "" : undefined}
      style={onMac && !isConnected ? { paddingLeft: 80 } : undefined}
      className="h-12 bg-bg border-b border-border flex items-center justify-between px-4 md:px-6"
    >
      <div
        data-tauri-drag-region={onMac ? "" : undefined}
        className="flex items-center gap-3 md:gap-6"
      >
        {isConnected && onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            aria-label="Open sidebar menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
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
        {version && (
          <span className="text-[11px] text-muted font-mono leading-none" title="App version">
            v{version}
          </span>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
    </header>
    </>
  );
};
