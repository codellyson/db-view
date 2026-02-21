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
    <div className="min-h-screen bg-bg">
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
            <h1 className="text-5xl font-bold tracking-tight text-primary mb-4">
              DBView
            </h1>
            <p className="text-lg text-secondary mb-3">
              PostgreSQL database explorer
            </p>
            <p className="text-sm text-muted max-w-2xl mx-auto">
              A clean, functional interface for browsing tables, running queries,
              and exploring your database.
            </p>
          </div>
          <div className="flex items-center justify-center my-8">
            <Button
              variant="primary"
              onClick={() => router.push("/connections")}
            >
              Get started
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-primary mb-2">
                Browse tables
              </h2>
              <p className="text-sm text-secondary">
                View all tables in your database with schema details, relationships,
                and statistics.
              </p>
            </div>

            <div className="border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-primary mb-2">
                Execute queries
              </h2>
              <p className="text-sm text-secondary">
                Run SQL queries with syntax highlighting, auto-completion,
                and explain plans.
              </p>
            </div>
            <div className="border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-primary mb-2">
                View schema
              </h2>
              <p className="text-sm text-secondary">
                Inspect table structures, column types, constraints, and
                foreign key relationships.
              </p>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-border text-center">
            <p className="text-xs text-muted mb-1">Created by</p>
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
