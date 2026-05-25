"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useConnection } from "./contexts/connection-context";
import { Dashboard } from "./components/dashboard";
import { Button } from "./components/ui";
import { useRouter } from "next/navigation";

// Promoted to constants so they render in the SSR'd HTML *and* so the FAQ
// JSON-LD below stays in sync with the visible copy. If you change a
// question or answer, edit it here once.
const FAQ = [
  {
    q: "Which databases work?",
    a: "PostgreSQL, MySQL/MariaDB, and SQLite (including libsql/Turso).",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. Tables become scannable cards, the SQL editor adapts, and it installs as a PWA.",
  },
  {
    q: "Can I use production credentials on the web version?",
    a: "Not recommended. Use staging or dev credentials on the web. For production, install the desktop app so the connection stays on your machine.",
  },
  {
    q: "Is it really free?",
    a: "Yes. No signup, no trial, no paywall. Built by KreativeKorna Concepts.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function Home() {
  const { isConnected } = useConnection();
  const router = useRouter();

  // In Tauri, the landing page (download CTAs, marketing copy) should never
  // show — the user is already running the desktop app. Default to hidden
  // and only render after we confirm we're in a web browser. This also keeps
  // index.html present in the export so Tauri's prod asset resolver loads.
  const [showLanding, setShowLanding] = useState(false);
  useEffect(() => {
    if ("__TAURI_INTERNALS__" in window) {
      router.replace("/connections");
    } else {
      setShowLanding(true);
    }
  }, [router]);

  if (isConnected) {
    return <Dashboard />;
  }

  if (!showLanding) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main className="container mx-auto px-6 sm:px-8 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <header className="text-center mb-16">
            <Image
              src="/logo.svg"
              alt="JustDB"
              width={64}
              height={64}
              priority
              className="mx-auto mb-6"
            />
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-primary mb-4">
              JustDB
            </h1>
            <p className="text-xl sm:text-2xl text-primary font-medium mb-6">
              See your database. Edit it. Query it.
            </p>
            <p className="text-base text-secondary leading-relaxed max-w-xl mx-auto">
              A clean database explorer for PostgreSQL, MySQL, and SQLite. Free,
              no signup.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Button variant="primary" onClick={() => router.push("/connections")}>
                Open JustDB
              </Button>
              <a
                href="https://github.com/codellyson/justdb/releases"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">Download desktop app</Button>
              </a>
            </div>
          </header>

          {/* How it works */}
          <section aria-labelledby="how-it-works" className="mb-16">
            <h2 id="how-it-works" className="text-xl font-semibold text-primary mb-6">
              How it works
            </h2>
            <ol className="space-y-4 text-secondary">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
                  1
                </span>
                <p>
                  <strong className="text-primary">Connect.</strong>{" "}
                  Paste your connection string and pick a driver.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
                  2
                </span>
                <p>
                  <strong className="text-primary">Browse.</strong>{" "}
                  Tables, columns, foreign keys, row counts. Pin what you use,
                  search the rest.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
                  3
                </span>
                <p>
                  <strong className="text-primary">Edit or query.</strong>{" "}
                  Inline edits with staged changes, or write SQL in a full editor.
                </p>
              </li>
            </ol>
          </section>

          {/* Desktop or web */}
          <section aria-labelledby="desktop-or-web" className="mb-16">
            <h2 id="desktop-or-web" className="text-xl font-semibold text-primary mb-3">
              Desktop or web?
            </h2>
            <p className="text-secondary leading-relaxed mb-3">
              The web version runs in your browser. Good for a quick look from
              a phone or borrowed laptop. Stick to staging or development
              credentials here.
            </p>
            <p className="text-secondary leading-relaxed">
              The desktop app runs locally on Mac, Windows, and Linux. Use it
              for daily work and production databases.
            </p>
          </section>

          {/* FAQ */}
          <section aria-labelledby="faq" className="mb-16">
            <h2 id="faq" className="text-xl font-semibold text-primary mb-6">
              Frequently asked questions
            </h2>
            <dl className="space-y-6">
              {FAQ.map(({ q, a }) => (
                <div key={q}>
                  <dt className="text-base font-medium text-primary mb-1.5">{q}</dt>
                  <dd className="text-sm text-secondary leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Footer */}
          <footer className="pt-8 border-t border-border text-center">
            <p className="text-xs text-muted mb-1">Built by</p>
            <a
              href="https://kreativekorna.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:text-accent transition-colors"
            >
              KreativeKorna Concepts
            </a>
            <p className="text-xs text-muted/70 mt-3">
              <Link href="/connections" className="hover:text-primary transition-colors">
                Connect a database
              </Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
