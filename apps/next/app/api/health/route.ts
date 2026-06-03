import { NextRequest, NextResponse } from "next/server";
import { getSessionProvider } from "@/lib/db";
import { checkHealth } from "@/lib/health-check";

export async function GET(_request: NextRequest) {
  try {
    const { provider } = await getSessionProvider();
    const status = await checkHealth(provider);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({
      healthy: false,
      latency: null,
      activeConnections: 0,
      idleConnections: 0,
      error: "No active connection pool",
    });
  }
}
