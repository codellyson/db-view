import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnection } from '../contexts/connection-context';
import { ConnectionForm } from '../components/connection-form';
import { SavedConnections } from '../components/saved-connections';
import { Header } from '../components/header';
import type { DBConfig } from '../types';

export function Connections() {
  const { isConnected, isConnecting, databaseName, connect, cancelConnect, error, savedConnections } = useConnection();
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
      <div className="flex-1 flex">
        {/* Center the column vertically too when not connected so the form
            doesn't sit at the top of a tall blank canvas on big monitors. */}
        <div
          className={`container mx-auto px-6 py-6 ${
            !isConnected ? 'flex flex-col justify-center' : ''
          }`}
        >
          <div
            className={`mx-auto w-full ${
              !isConnected && savedConnections.length > 0 ? 'max-w-5xl' : 'max-w-xl'
            }`}
          >
            {!isConnected && (
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold tracking-tight text-primary">
                  JustDB
                </h1>
                <p className="text-xs text-accent font-medium">
                  Just your data, no bullshit.
                </p>
                {!showWebNotice && (
                  <p className="text-[11px] text-muted">
                    Connect directly — your credentials never leave this device.
                  </p>
                )}
              </div>
            )}

            {!isConnected && showWebNotice && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-md">
                <p className="text-sm font-semibold text-warning mb-0.5">
                  This web version is for evaluation only
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Don't use production credentials. Install the desktop app for real work.
                </p>
              </div>
            )}

            {isConnected && (
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-primary mb-0.5">
                  Connections
                </h2>
                <p className="text-xs text-muted">
                  Switch databases or add a new one. All credentials stay local.
                </p>
              </div>
            )}

            {/* Two-column on lg+ when there's something to put on each side;
                otherwise a single centered column. */}
            <div
              className={`${
                !isConnected && savedConnections.length > 0
                  ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start'
                  : 'space-y-4'
              }`}
            >
              <SavedConnections />
              <ConnectionForm
                onConnect={handleConnect}
                isConnecting={isConnecting}
                onCancel={cancelConnect}
              />
            </div>

            {error && (
              <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm">
                {error}
              </div>
            )}

            {!isConnected && (
              <div className="mt-6 pt-4 border-t border-border text-center">
                <span className="text-[11px] text-muted">Built by </span>
                <a
                  href="https://kreativekorna.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-primary hover:text-accent transition-colors"
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
