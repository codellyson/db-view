// Simple sliding-window rate limiter. No external deps — in-memory Map with
// automatic stale-entry cleanup. Good enough for single-process deployments.

interface WindowEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  // Maximum number of requests allowed within the window.
  limit: number;
  // Window duration in milliseconds.
  windowMs: number;
}

const stores = new Map<string, Map<string, WindowEntry>>();

// Cleanup stale entries every 60 seconds per store.
function ensureCleanup(storeName: string, windowMs: number) {
  if (stores.has(storeName)) return;
  const store = new Map<string, WindowEntry>();
  stores.set(storeName, store);
  const interval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 60_000);
  // Don't keep the process alive just for cleanup.
  if (typeof interval === 'object' && 'unref' in interval) interval.unref();
}

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  const { limit, windowMs } = options;
  ensureCleanup(name, windowMs);
  const store = stores.get(name)!;

  return {
    /**
     * Check whether the key is allowed. If yes, records the hit and returns
     * `{ allowed: true, remaining }`. If no, returns `{ allowed: false,
     * retryAfterMs }` — the caller should 429.
     */
    check(key: string): { allowed: true; remaining: number } | { allowed: false; retryAfterMs: number } {
      const now = Date.now();
      const cutoff = now - windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Drop timestamps outside the window.
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

      if (entry.timestamps.length >= limit) {
        const oldest = entry.timestamps[0];
        const retryAfterMs = oldest + windowMs - now;
        return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
      }

      entry.timestamps.push(now);
      return { allowed: true, remaining: limit - entry.timestamps.length };
    },
  };
}

// Pre-configured limiters for the app. Adjust numbers via env vars or here.

// /api/query — 30 requests per 60s per session.
export const queryLimiter = createRateLimiter('query', {
  limit: parseInt(process.env.RATE_LIMIT_QUERY || '30', 10),
  windowMs: 60_000,
});

// /api/mutate — 20 requests per 60s per session.
export const mutateLimiter = createRateLimiter('mutate', {
  limit: parseInt(process.env.RATE_LIMIT_MUTATE || '20', 10),
  windowMs: 60_000,
});

// /api/connect — 5 attempts per 60s per IP (no session cookie yet).
export const connectLimiter = createRateLimiter('connect', {
  limit: parseInt(process.env.RATE_LIMIT_CONNECT || '5', 10),
  windowMs: 60_000,
});
