"use client";

import Image from "next/image";
import { useConnection } from "./contexts/connection-context";
import { Dashboard } from "./components/dashboard";
import { Button } from "./components/ui";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isConnected } = useConnection();
  const router = useRouter();

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
          <div className="flex items-center justify-center my-8">
            <Button
              variant="primary"
              onClick={() => router.push("/connections")}
            >
              GET STARTED
            </Button>
          </div>
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
