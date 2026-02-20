'use client';

import React from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ConnectionStatus } from './connection-status';
import { ConnectionSelector } from './connection-selector';
import { Button } from './ui/button';
import { useConnection } from '../contexts/connection-context';
import { useTheme } from '../contexts/theme-context';

interface HeaderProps {
  isConnected: boolean;
  databaseName?: string;
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  databaseName,
  onMenuToggle,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { disconnect } = useConnection();
  const { theme, toggleTheme } = useTheme();

  const handleDisconnect = async () => {
    await disconnect();
    router.push('/');
  };

  return (
    <header className="h-16 bg-black dark:bg-white border-b-2 border-black dark:border-white flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-4 md:gap-8">
        {/* Hamburger menu button - mobile only */}
        {isConnected && onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden flex flex-col gap-1 p-1"
            aria-label="Open sidebar menu"
          >
            <span className="block w-5 h-0.5 bg-white dark:bg-black" />
            <span className="block w-5 h-0.5 bg-white dark:bg-black" />
            <span className="block w-5 h-0.5 bg-white dark:bg-black" />
          </button>
        )}
        <div className="flex items-center gap-2 md:gap-4">
          <Image
            src="/logo.svg"
            alt="DBView"
            width={32}
            height={32}
            priority
            className="md:w-10 md:h-10"
          />
          <h1 className="text-lg md:text-2xl font-bold uppercase text-white dark:text-black">DBVIEW</h1>
        </div>
        {isConnected && (
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              aria-current={pathname === '/' ? 'page' : undefined}
              className={`text-sm font-bold uppercase font-mono border-2 px-4 py-2 ${
                pathname === '/'
                  ? 'bg-blue-400 text-black border-blue-400'
                  : 'bg-black dark:bg-white text-white dark:text-black border-white dark:border-black hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white'
              }`}
            >
              TABLES
            </button>
            <button
              onClick={() => router.push('/query')}
              aria-current={pathname === '/query' ? 'page' : undefined}
              className={`text-sm font-bold uppercase font-mono border-2 px-4 py-2 ${
                pathname === '/query'
                  ? 'bg-blue-400 text-black border-blue-400'
                  : 'bg-black dark:bg-white text-white dark:text-black border-white dark:border-black hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white'
              }`}
            >
              QUERY
            </button>
            <button
              onClick={() => router.push('/connections')}
              aria-current={pathname === '/connections' ? 'page' : undefined}
              className={`text-sm font-bold uppercase font-mono border-2 px-4 py-2 ${
                pathname === '/connections'
                  ? 'bg-blue-400 text-black border-blue-400'
                  : 'bg-black dark:bg-white text-white dark:text-black border-white dark:border-black hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white'
              }`}
            >
              CONNECTIONS
            </button>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={toggleTheme}
          className="text-sm font-bold uppercase font-mono border-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black border-white dark:border-black hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? 'DARK' : 'LIGHT'}
        </button>
        {isConnected && <span className="hidden md:block"><ConnectionSelector /></span>}
        <span className="hidden sm:block">
          <ConnectionStatus
            status={isConnected ? 'connected' : 'disconnected'}
            databaseName={databaseName}
          />
        </span>
        {isConnected && (
          <Button variant="ghost" size="sm" onClick={handleDisconnect}>
            DISCONNECT
          </Button>
        )}
      </div>
    </header>
  );
};
