interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  '/api/connect': { maxRequests: 5, windowMs: 60_000 },
  '/api/query': { maxRequests: 30, windowMs: 60_000 },
  '/api/explain': { maxRequests: 20, windowMs: 60_000 },
  default: { maxRequests: 100, windowMs: 60_000 },
};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < 120_000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 300_000);

export function checkRateLimit(
  ip: string,
  path: string
): { allowed: boolean; retryAfter?: number } {
  const normalizedPath = Object.keys(RATE_LIMITS).find((p) => path.startsWith(p)) || 'default';
  const { maxRequests, windowMs } = RATE_LIMITS[normalizedPath];

  const key = `${ip}:${normalizedPath}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}
