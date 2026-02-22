'use client';

import React from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ConnectionStatus } from './connection-status';
import { ConnectionSelector } from './connection-selector';
import { Button } from './ui/button';
import { useConnection } from '../contexts/connection-context';

interface HeaderProps {
  isConnected: boolean;
  databaseName?: string;
  onMenuToggle?: () => void;
  onShortcutsHelp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  databaseName,
  onMenuToggle,
  onShortcutsHelp,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { disconnect } = useConnection();

  const handleDisconnect = async () => {
    await disconnect();
    router.push('/');
  };

  const navItems = [
    { label: 'Tables', path: '/' },
    { label: 'Query', path: '/query' },
    { label: 'ER Diagram', path: '/er-diagram' },
    { label: 'Performance', path: '/performance' },
    { label: 'Connections', path: '/connections' },
  ];

  return (
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
        {isConnected && (
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                aria-current={pathname === item.path ? 'page' : undefined}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  pathname === item.path
                    ? 'bg-accent/10 text-accent'
                    : 'text-secondary hover:text-primary hover:bg-bg-secondary'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {isConnected && <span className="hidden md:block"><ConnectionSelector /></span>}
        <span className="hidden sm:block">
          <ConnectionStatus
            status={isConnected ? 'connected' : 'disconnected'}
            databaseName={databaseName}
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
  );
};
