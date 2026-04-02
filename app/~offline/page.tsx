"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg
            width="80"
            height="80"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto opacity-40"
          >
            <rect x="10" y="10" width="180" height="180" stroke="currentColor" strokeWidth="4" fill="none" />
            <rect x="30" y="30" width="50" height="50" stroke="currentColor" strokeWidth="3" fill="none" />
            <rect x="90" y="30" width="50" height="50" stroke="currentColor" strokeWidth="3" fill="currentColor" />
            <rect x="30" y="90" width="50" height="50" stroke="currentColor" strokeWidth="3" fill="currentColor" />
            <rect x="90" y="90" width="50" height="50" stroke="currentColor" strokeWidth="3" fill="none" />
            <circle cx="100" cy="100" r="15" stroke="currentColor" strokeWidth="3" fill="none" />
            <circle cx="100" cy="100" r="6" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          You&apos;re offline
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          DBView needs a network connection to connect to your databases. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
