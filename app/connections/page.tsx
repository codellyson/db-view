"use client";

import Image from "next/image";
import { useConnection } from "../contexts/connection-context";
import { ConnectionForm } from "../components/connection-form";
import { SavedConnections } from "../components/saved-connections";
import { Button } from "../components/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ConnectionsPage() {
  const { isConnected, isConnecting, connect, error } = useConnection();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  const handleConnect = async (config: any, name?: string) => {
    try {
      await connect(config, name);
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  if (isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-8 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-8">
              <Image
                src="/logo.svg"
                alt="DBView"
                width={128}
                height={128}
                priority
              />
            </div>
            <h1 className="text-6xl font-bold uppercase tracking-tight text-black mb-6">
              DBVIEW
            </h1>
            <p className="text-xl font-mono text-black mb-4">
              BRUTALIST POSTGRESQL DATABASE EXPLORER
            </p>
            <p className="text-base font-mono text-black max-w-2xl mx-auto">
              RAW. FUNCTIONAL. NO BULLSHIT. EXPLORE YOUR DATABASE WITH A
              MINIMALIST INTERFACE THAT GETS OUT OF YOUR WAY.
            </p>
          </div>

          <div className="space-y-8">
            <SavedConnections />
            <ConnectionForm
              onConnect={handleConnect}
              isConnecting={isConnecting}
            />
          </div>

          {error && (
            <div className="mt-8 p-4 bg-red-500 border-2 border-black text-white font-bold uppercase">
              {error}
            </div>
          )}

          <div className="mt-16 pt-8 border-t-2 border-black text-center">
            <p className="text-sm font-mono text-black mb-2">CREATED BY</p>
            <a
              href="https://kreativekorna.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-bold uppercase text-black hover:underline"
            >
              KREATIVEKORNA CONCEPTS
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

