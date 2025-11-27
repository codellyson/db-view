"use client";

import Image from "next/image";
import { useConnection } from "./contexts/connection-context";
import { ConnectionForm } from "./components/connection-form";
import { Dashboard } from "./components/dashboard";
import { Button } from "./components/ui";

export default function Home() {
  const { isConnected, isConnecting, connect, error } = useConnection();

  const handleConnect = async (config: any) => {
    try {
      await connect(config);
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  if (isConnected) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-8 py-16">
        <div className="max-w-4xl mx-auto">
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
          <a
            href="#connection-form"
            className=" flex items-center justify-center w-max mx-auto text-center my-8"
          >
            <Button variant="primary" className="w-max text-center">
              GET STARTED
            </Button>
          </a>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="border-2 border-black p-8">
              <h2 className="text-2xl font-bold uppercase text-black mb-4">
                BROWSE TABLES
              </h2>
              <p className="text-base font-mono text-black">
                VIEW ALL TABLES IN YOUR DATABASE. NAVIGATE WITH SHARP BORDERS
                AND HIGH CONTRAST.
              </p>
            </div>

            <div className="border-2 border-black p-8">
              <h2 className="text-2xl font-bold uppercase text-black mb-4">
                EXECUTE QUERIES
              </h2>
              <p className="text-base font-mono text-black">
                RUN SQL QUERIES DIRECTLY. MONOSPACE FONT. INSTANT RESULTS. NO
                DISTRACTIONS.
              </p>
            </div>
            <div className="border-2 border-black p-8">
              <h2 className="text-2xl font-bold uppercase text-black mb-4">
                VIEW SCHEMA
              </h2>
              <p className="text-base font-mono text-black">
                INSPECT TABLE STRUCTURES. COLUMN TYPES. CONSTRAINTS. ALL IN ONE
                PLACE.
              </p>
            </div>
          </div>

          <div id="connection-form">
            <ConnectionForm
              onConnect={handleConnect}
              isConnecting={isConnecting}
            />
          </div>

          <div className="mt-16 pt-8 border-t-2 border-black text-center">
            <p className="text-sm font-mono text-black mb-2">CREATED BY</p>
            <a
              href="https://kreativekorna.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-bold uppercase text-black hover:underline inline-block"
            >
              KREATIVEKORNA CONCEPTS
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
