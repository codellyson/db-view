"use client";

import Image from "next/image";
import Link from "next/link";
import { useConnection } from "./contexts/connection-context";
import { Dashboard } from "./components/dashboard";
import { Button } from "./components/ui";
import { InstallAppButton } from "./components/install-app-button";
import { useRouter } from "next/navigation";

// Promoted to constants so they render in the SSR'd HTML *and* so the FAQ
// JSON-LD below stays in sync with the visible copy. If you change a
// question or answer, edit it here once.
const FAQ = [
  {
    q: "What is JustDB?",
    a: "JustDB is a browser-based database explorer for PostgreSQL, MySQL, and SQLite. You connect once, then browse tables, run SQL, and edit rows from any device — desktop, tablet, or phone.",
  },
  {
    q: "Where do my database credentials go?",
    a: "Nowhere. Credentials are stored locally in your browser. Queries run from your browser straight to your database. No middleman, no cloud relay, no data lake.",
  },
  {
    q: "Which databases are supported?",
    a: "PostgreSQL, MySQL/MariaDB, and SQLite (including libsql/Turso). Pick a driver on the connections page, paste your connection details, and you're in.",
  },
  {
    q: "Can I use JustDB on a phone?",
    a: "Yes. That's the whole point. Tables render as scannable cards on small screens, the SQL editor adapts, and JustDB installs as a PWA so it sits next to your other apps.",
  },
  {
    q: "Is JustDB free?",
    a: "Yes. JustDB is free to use, with no signup. It's built and maintained by KreativeKorna Concepts.",
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

  if (isConnected) {
    return <Dashboard />;
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
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-primary mb-3">
              Database Explorer for PostgreSQL, MySQL &amp; SQLite
            </h1>
            <p className="text-lg text-accent font-medium mb-4">
              Just your data, no bullshit.
            </p>
            <p className="text-base text-secondary leading-relaxed max-w-xl mx-auto">
              Browse tables, run SQL, and edit rows from any device. JustDB connects
              straight from your browser to your database — your credentials never
              leave the page.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Button variant="primary" onClick={() => router.push("/connections")}>
                Connect a database
              </Button>
              <InstallAppButton />
            </div>

            <p className="text-xs text-muted/70 mt-4">
              Free · No signup · PostgreSQL · MySQL · SQLite
            </p>
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
                  <strong className="text-primary">Add a connection.</strong>{" "}
                  Paste your PostgreSQL, MySQL, or SQLite connection string. Saved
                  in your browser, not on a server.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
                  2
                </span>
                <p>
                  <strong className="text-primary">Browse and search.</strong>{" "}
                  Tables, columns, foreign keys, and row counts surface instantly.
                  Pin the ones you use, fuzzy-search the rest.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
                  3
                </span>
                <p>
                  <strong className="text-primary">Edit or query.</strong>{" "}
                  Inline-edit cells with staged changes you can review before
                  commit, or run SQL in a full editor with syntax highlighting.
                </p>
              </li>
            </ol>
          </section>

          {/* Privacy */}
          <section aria-labelledby="privacy" className="mb-16">
            <h2 id="privacy" className="text-xl font-semibold text-primary mb-3">
              Privacy by default
            </h2>
            <p className="text-secondary leading-relaxed">
              JustDB is not a managed service. Your connection details, queries,
              and results stay between your browser and your database. There is
              no telemetry, no analytics on your data, and no third-party relay
              in the request path.
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
