'use client';

import React from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ConnectionStatus } from './connection-status';
import { ConnectionSelector } from './connection-selector';
import { Button } from './ui/button';
import { useConnection } from '../contexts/connection-context';
import { useConnectionHealth } from '../hooks/use-connection-health';

interface HeaderProps {
  isConnected: boolean;
  databaseName?: string;
  tableCount?: number;
  onMenuToggle?: () => void;
  onShortcutsHelp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  databaseName,
  tableCount,
  onMenuToggle,
  onShortcutsHelp,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { disconnect } = useConnection();
  const { latency, healthy } = useConnectionHealth(isConnected);

  const handleDisconnect = async () => {
    await disconnect();
    router.push('/');
  };

  const handleReconnect = () => {
    // Force a re-poll by routing back to root which performs a connection
    // restore via the existing flow, then back to the dashboard.
    router.push('/');
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
    <header className="h-14 bg-bg border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 md:gap-6">
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
            onClick={() => router.push('/')}
            className="flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-bg-secondary transition-colors"
            aria-label="Back to tables"
          >
            <Image
              src="/logo.svg"
              alt="DBView"
              width={28}
              height={28}
              priority
            />
            <span className="text-base font-semibold text-primary">DBView</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="DBView"
              width={28}
              height={28}
              priority
            />
            <span className="text-base font-semibold text-primary">DBView</span>
          </div>
        )}
        {isConnected && (
          <nav aria-label="Main navigation" className="flex items-center gap-1">
            <button
              onClick={() => router.push('/')}
              aria-current={pathname === '/' ? 'page' : undefined}
              className={`inline-flex text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                pathname === '/'
                  ? 'bg-accent/10 text-accent'
                  : 'text-secondary hover:text-primary hover:bg-bg-secondary'
              }`}
            >
              Workspace
            </button>
            <button
              onClick={() => router.push('/connections')}
              aria-current={pathname === '/connections' ? 'page' : undefined}
              className={`inline-flex text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                pathname === '/connections'
                  ? 'bg-accent/10 text-accent'
                  : 'text-secondary hover:text-primary hover:bg-bg-secondary'
              }`}
            >
              Connections
            </button>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {isConnected && <span className="hidden md:block"><ConnectionSelector /></span>}
        <span className="hidden sm:block">
          <ConnectionStatus
            status={isConnected ? (healthy ? 'connected' : 'connecting') : 'disconnected'}
            databaseName={databaseName}
            latency={latency}
            tableCount={tableCount}
            onClick={() => router.push('/')}
          />
        </span>
        {isConnected && onShortcutsHelp && (
          <button
            onClick={onShortcutsHelp}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            title="Keyboard shortcuts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        {isConnected && (
          <Button variant="ghost" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        )}
      </div>
    </header>
    </>
  );
};
