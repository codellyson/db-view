'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface HealthState {
  latency: number | null;
  healthy: boolean;
}

const POLL_INTERVAL_MS = 30_000;

/**
 * Periodically ping `/api/health` and return the latest latency. Used by the
 * header pill to show liveness + speed at a glance.
 */
export function useConnectionHealth(isConnected: boolean): HealthState {
  const [state, setState] = useState<HealthState>({ latency: null, healthy: true });

  useEffect(() => {
    if (!isConnected) {
      setState({ latency: null, healthy: false });
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.get('/api/health');
        if (cancelled) return;
        setState({
          latency: typeof data.latency === 'number' ? data.latency : null,
          healthy: !!data.healthy,
        });
      } catch {
        if (cancelled) return;
        setState({ latency: null, healthy: false });
      }
    };
    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isConnected]);

  return state;
}
