import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnection } from '../contexts/connection-context';
import { ConnectionForm } from '../components/connection-form';
import { SavedConnections } from '../components/saved-connections';
import { Header } from '../components/header';
import type { DBConfig } from '../types';

export function Connections() {
  const { isConnected, isConnecting, databaseName, connect, cancelConnect, error } = useConnection();
  const navigate = useNavigate();

  // Web-only notice: the SaaS round-trips credentials through a shared server,
  // so it's only suitable for evaluation. Desktop keeps credentials in the OS
  // keychain. Initial state is `false` so Tauri never flashes the warning.
  const [showWebNotice, setShowWebNotice] = useState(false);
  useEffect(() => {
    setShowWebNotice(!('__TAURI_INTERNALS__' in window));
  }, []);

  const handleConnect = async (config: DBConfig, name?: string) => {
    try {
      await connect(config, name);
      navigate('/');
    } catch (err) {
      console.error('Connection error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {isConnected && (
        <Header isConnected={isConnected} databaseName={databaseName} />
      )}
      <div className="flex-1">
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-xl mx-auto">
            {!isConnected && (
              <div className="text-center mb-10">
                <div className="flex justify-center mb-6">
                  <img src="/logo.svg" alt="JustDB" width={80} height={80} />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-primary mb-2">
                  JustDB
                </h1>
                <p className="text-sm text-accent font-medium mb-1">
                  Just your data, no bullshit.
                </p>
                {!showWebNotice && (
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Connect directly — your credentials never leave this device.
                  </p>
                )}
              </div>
            )}

            {!isConnected && showWebNotice && (
              <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-md">
                <p className="text-sm font-semibold text-warning mb-1">
                  This web version is for evaluation only
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Don't use production credentials. Install the desktop app for real work.
                </p>
              </div>
            )}

            {isConnected && (
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-primary mb-1">
                  Connections
                </h2>
                <p className="text-sm text-muted">
                  Switch databases or add a new one. All credentials stay local.
                </p>
              </div>
            )}

            <div className="space-y-6">
              <SavedConnections />
              <ConnectionForm
                onConnect={handleConnect}
                isConnecting={isConnecting}
                onCancel={cancelConnect}
              />
            </div>

            {error && (
              <div className="mt-6 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm">
                {error}
              </div>
            )}

            {!isConnected && (
              <div className="mt-10 pt-6 border-t border-border text-center">
                <p className="text-xs text-muted mb-1">Built by</p>
                <a
                  href="https://kreativekorna.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:text-accent transition-colors"
                >
                  KreativeKorna Concepts
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
