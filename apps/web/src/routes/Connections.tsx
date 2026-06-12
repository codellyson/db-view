import { useEffect, useState } from 'react';
import { useConnection } from '../contexts/connection-context';
import { ConnectionForm } from '../components/connection-form';
import { SavedConnections } from '../components/saved-connections';
import type { DBConfig } from '../types';

// The disconnected landing — saved connections + new-connection form.
// Rendered inline by `Home` when there's no active session. There's no
// dedicated route any more; this component is just the !isConnected view
// of `/`.
export function Connections() {
  const { isConnecting, connect, cancelConnect, error, savedConnections } = useConnection();

  // Web-only notice: the SaaS round-trips credentials through a shared server,
  // so it's only suitable for evaluation. Desktop keeps credentials in the OS
  // keychain. Initial state is `false` so Tauri never flashes the warning.
  const [showWebNotice, setShowWebNotice] = useState(false);
  useEffect(() => {
    setShowWebNotice(!('__TAURI_INTERNALS__' in window));
  }, []);

  const handleConnect = async (config: DBConfig, name?: string) => {
    try {
      // No explicit navigation — once connect() flips isConnected, Home
      // re-renders and replaces this view with the Dashboard.
      await connect(config, name);
    } catch (err) {
      console.error('Connection error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex-1 flex">
        {/* Vertically centered so the form doesn't sit at the top of a
            tall blank canvas on big monitors. */}
        <div className="container mx-auto px-6 py-6 flex flex-col justify-center">
          <div
            className={`mx-auto w-full ${
              savedConnections.length > 0 ? 'max-w-5xl' : 'max-w-xl'
            }`}
          >
            <div className="text-center mb-6 flex flex-col items-center">
              {/* Logo scaled to match the title's visual weight — much
                  smaller than the original 80px so it doesn't dominate
                  the compact form layout. */}
              <img
                src="/logo.svg"
                alt="JustDB"
                width={36}
                height={36}
                className="mb-2"
              />
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

            {showWebNotice && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-md">
                <p className="text-sm font-semibold text-warning mb-0.5">
                  This web version is for evaluation only
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Don't use production credentials. Install the desktop app for real work.
                </p>
              </div>
            )}

            {/* Two-column on lg+ when there's something to put on each side;
                otherwise a single centered column. */}
            <div
              className={
                savedConnections.length > 0
                  ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start'
                  : 'space-y-4'
              }
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
          </div>
        </div>
      </div>
    </div>
  );
}
