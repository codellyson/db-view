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
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  databaseName,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { disconnect } = useConnection();

  const handleDisconnect = async () => {
    await disconnect();
    router.push('/');
  };

  return (
    <header className="h-16 bg-black border-b-2 border-black flex items-center justify-between px-8">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4">
          <Image
            src="/logo.svg"
            alt="DBView"
            width={40}
            height={40}
            priority
          />
          <h1 className="text-2xl font-bold uppercase text-white">DBVIEW</h1>
        </div>
        {isConnected && (
          <nav className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className={`text-sm font-bold uppercase font-mono border-2 px-4 py-2 ${
                pathname === '/'
                  ? 'bg-blue-400 text-black border-blue-400'
                  : 'bg-black text-white border-white hover:bg-white hover:text-black'
              }`}
            >
              TABLES
            </button>
            <button
              onClick={() => router.push('/query')}
              className={`text-sm font-bold uppercase font-mono border-2 px-4 py-2 ${
                pathname === '/query'
                  ? 'bg-blue-400 text-black border-blue-400'
                  : 'bg-black text-white border-white hover:bg-white hover:text-black'
              }`}
            >
              QUERY
            </button>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-4">
        {isConnected && <ConnectionSelector />}
        <ConnectionStatus
          status={isConnected ? 'connected' : 'disconnected'}
          databaseName={databaseName}
        />
        {isConnected && (
          <Button variant="ghost" size="sm" onClick={handleDisconnect}>
            DISCONNECT
          </Button>
        )}
      </div>
    </header>
  );
};

