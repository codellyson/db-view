import { Pool } from "pg";

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

export function startHealthCheck(pool: Pool): void {
  stopHealthCheck();

  const check = async () => {
    const start = Date.now();
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      const latency = Date.now() - start;

      healthStatus = {
        healthy: true,
        latency,
        activeConnections: pool.totalCount - pool.idleCount,
        idleConnections: pool.idleCount,
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
        healthStatus.activeConnections = pool.totalCount - pool.idleCount;
        healthStatus.idleConnections = pool.idleCount;
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
