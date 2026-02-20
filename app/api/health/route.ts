import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getHealthStatus } from "@/lib/health-check";

export async function GET() {
  const pool = getPool();

  if (!pool) {
    return NextResponse.json({
      healthy: false,
      latency: null,
      activeConnections: 0,
      idleConnections: 0,
      error: "No active connection pool",
    });
  }

  const status = getHealthStatus();
  return NextResponse.json(status);
}
