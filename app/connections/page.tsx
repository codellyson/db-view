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
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
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
                    alt="DBView"
                    width={80}
                    height={80}
                    priority
                  />
                </div>
                <h1 className="text-4xl font-bold uppercase tracking-tight text-black dark:text-white mb-3">
                  DBVIEW
                </h1>
                <p className="text-sm font-mono text-black dark:text-white mb-2">
                  BRUTALIST POSTGRESQL DATABASE EXPLORER
                </p>
                <p className="text-xs font-mono text-black/60 dark:text-white/60 max-w-md mx-auto">
                  RAW. FUNCTIONAL. NO BULLSHIT. EXPLORE YOUR DATABASE WITH A
                  MINIMALIST INTERFACE THAT GETS OUT OF YOUR WAY.
                </p>
              </div>
            )}

            {isConnected && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-tight text-black dark:text-white mb-1">
                  CONNECTIONS
                </h2>
                <p className="text-xs font-mono text-black/60 dark:text-white/60">
                  MANAGE SAVED CONNECTIONS OR CONNECT TO A NEW DATABASE.
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
              <div className="mt-6 p-3 bg-red-500 border-2 border-black dark:border-white text-white text-sm font-bold uppercase">
                {error}
              </div>
            )}

            {!isConnected && (
              <div className="mt-10 pt-6 border-t-2 border-black dark:border-white text-center">
                <p className="text-xs font-mono text-black/60 dark:text-white/60 mb-1">CREATED BY</p>
                <a
                  href="https://kreativekorna.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold uppercase text-black dark:text-white hover:underline"
                >
                  KREATIVEKORNA CONCEPTS
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
