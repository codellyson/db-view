import { DatabaseProvider } from "./db-provider";

interface HealthStatus {
  healthy: boolean;
  latency: number | null;
  activeConnections: number;
  idleConnections: number;
}

/**
 * Perform a one-shot health check for a specific provider.
 * With session-scoped pools there's no single global provider to
 * monitor on a timer — each session's pool is checked on demand.
 */
export async function checkHealth(provider: DatabaseProvider): Promise<HealthStatus> {
  const start = Date.now();
  try {
    await provider.healthPing();
    const latency = Date.now() - start;
    const info = provider.getHealthInfo();
    return {
      healthy: true,
      latency,
      activeConnections: info.totalCount - info.idleCount,
      idleConnections: info.idleCount,
    };
  } catch {
    const info = (() => {
      try {
        return provider.getHealthInfo();
      } catch {
        return { totalCount: 0, idleCount: 0 };
      }
    })();
    return {
      healthy: false,
      latency: null,
      activeConnections: info.totalCount - info.idleCount,
      idleConnections: info.idleCount,
    };
  }
}
