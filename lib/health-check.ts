import { DatabaseProvider } from "./db-provider";

interface HealthStatus {
  healthy: boolean;
  latency: number | null;
  activeConnections: number;
  idleConnections: number;
  failureCount: number;
  lastCheck: number | null;
}

let healthStatus: HealthStatus = {
  healthy: true,
  latency: null,
  activeConnections: 0,
  idleConnections: 0,
  failureCount: 0,
  lastCheck: null,
};

let healthInterval: NodeJS.Timeout | null = null;
const MAX_FAILURES = 3;

export function startHealthCheck(provider: DatabaseProvider): void {
  stopHealthCheck();

  const check = async () => {
    const start = Date.now();
    try {
      await provider.healthPing();
      const latency = Date.now() - start;
      const info = provider.getHealthInfo();

      healthStatus = {
        healthy: true,
        latency,
        activeConnections: info.totalCount - info.idleCount,
        idleConnections: info.idleCount,
        failureCount: 0,
        lastCheck: Date.now(),
      };
    } catch (error) {
      healthStatus.failureCount += 1;
      healthStatus.lastCheck = Date.now();
      healthStatus.latency = null;

      if (healthStatus.failureCount >= MAX_FAILURES) {
        healthStatus.healthy = false;
      }

      try {
        const info = provider.getHealthInfo();
        healthStatus.activeConnections = info.totalCount - info.idleCount;
        healthStatus.idleConnections = info.idleCount;
      } catch {
        // pool may be ended
      }
    }
  };

  // Initial check
  check();
  healthInterval = setInterval(check, 30_000);
}

export function stopHealthCheck(): void {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
}

export function getHealthStatus(): HealthStatus {
  return { ...healthStatus };
}

export function resetHealthStatus(): void {
  healthStatus = {
    healthy: true,
    latency: null,
    activeConnections: 0,
    idleConnections: 0,
    failureCount: 0,
    lastCheck: null,
  };
}
