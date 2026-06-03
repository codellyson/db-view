// Stub. The real Connections page is at apps/next/app/connections/page.tsx
// and is the next chunk to port: connection list, connection form, saved
// connections in the OS keychain (Tauri) or localStorage (web).
export function Connections() {
  return (
    <main className="container mx-auto px-6 sm:px-8 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold text-primary mb-2">Connections</h1>
        <p className="text-sm text-muted mb-6">
          Vite port in progress. See <code className="font-mono">apps/next/app/connections/page.tsx</code> for the
          current implementation.
        </p>
        <div className="rounded-md border border-border bg-bg-secondary p-4 text-sm text-secondary">
          This is the Vite/React entrypoint that will eventually replace the Next.js
          route. Hot reload, dev proxy to <code className="font-mono">/api</code>, and design tokens are all wired up.
        </div>
      </div>
    </main>
  );
}
