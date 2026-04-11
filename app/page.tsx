"use client";

import Image from "next/image";
import { useConnection } from "./contexts/connection-context";
import { Dashboard } from "./components/dashboard";
import { Button } from "./components/ui";
import { InstallAppButton } from "./components/install-app-button";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isConnected } = useConnection();
  const router = useRouter();

  if (isConnected) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container mx-auto px-6 sm:px-8 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="flex justify-center mb-6">
              <Image
                src="/logo.svg"
                alt="DBView"
                width={96}
                height={96}
                priority
              />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-primary mb-3">
              DBView
            </h1>
            <p className="text-lg text-accent font-medium mb-3">
              Your database in your pocket.
            </p>
            <p className="text-sm text-muted max-w-sm mx-auto mb-2">
              Browse tables, run queries, and inspect schemas on any device.
              Built for the moments you&apos;re away from your desk.
            </p>
            <p className="text-xs text-muted/70 max-w-xs mx-auto">
              Connects directly to your database. No data is sent to any remote server — credentials stay in your browser.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 my-8">
            <Button
              variant="primary"
              onClick={() => router.push("/connections")}
            >
              Connect a database
            </Button>
            <InstallAppButton />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-16">
            <div className="border border-border rounded-lg p-5 sm:p-6">
              <h2 className="text-base font-semibold text-primary mb-1.5">
                Tap, browse, done
              </h2>
              <p className="text-sm text-secondary">
                Tables render as cards on mobile. Tap a row to see every field. No squinting, no side-scrolling.
              </p>
            </div>

            <div className="border border-border rounded-lg p-5 sm:p-6">
              <h2 className="text-base font-semibold text-primary mb-1.5">
                Query from anywhere
              </h2>
              <p className="text-sm text-secondary">
                Full SQL editor with syntax highlighting. Check a production value without opening your laptop.
              </p>
            </div>
            <div className="border border-border rounded-lg p-5 sm:p-6">
              <h2 className="text-base font-semibold text-primary mb-1.5">
                Nothing leaves your browser
              </h2>
              <p className="text-sm text-secondary">
                Credentials are stored locally. Queries run directly against your database. No middleman, no cloud relay.
              </p>
            </div>
          </div>

          <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-border text-center">
            <p className="text-xs text-muted mb-1">Built by</p>
            <a
              href="https://kreativekorna.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:text-accent transition-colors inline-block"
            >
              KreativeKorna Concepts
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
