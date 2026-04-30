"use client";

import Image from "next/image";
import { useConnection } from "../contexts/connection-context";
import { ConnectionForm } from "../components/connection-form";
import { SavedConnections } from "../components/saved-connections";
import { Header } from "../components/header";
import { useRouter } from "next/navigation";

export default function ConnectionsPage() {
  const { isConnected, isConnecting, databaseName, connect, error } = useConnection();
  const router = useRouter();

  const handleConnect = async (config: any, name?: string) => {
    try {
      await connect(config, name);
      router.push("/");
    } catch (err) {
      console.error("Connection error:", err);
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
                  <Image
                    src="/logo.svg"
                    alt="Pocketdb"
                    width={80}
                    height={80}
                    priority
                  />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-primary mb-2">
                  Pocketdb
                </h1>
                <p className="text-sm text-accent font-medium mb-1">
                  Your database in your pocket.
                </p>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Connect directly — your credentials never leave this device.
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
