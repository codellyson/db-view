"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function usePolling(
  fetchFn: () => Promise<void>,
  intervalMs: number,
  enabled: boolean = true
): {
  isLoading: boolean;
  refresh: () => void;
  lastUpdated: number | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const fetchRef = useRef(fetchFn);
  const mountedRef = useRef(true);

  fetchRef.current = fetchFn;

  const doFetch = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    try {
      await fetchRef.current();
      if (mountedRef.current) {
        setLastUpdated(Date.now());
      }
    } catch {
      // Errors handled by the fetchFn itself
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, doFetch]);

  return { isLoading, refresh: doFetch, lastUpdated };
}
