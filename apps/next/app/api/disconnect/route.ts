import { NextResponse } from "next/server";
import { disconnectSession } from "@/lib/db";
import { removeConnection } from "@/lib/connection-store";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("db-session")?.value;
    if (sessionId) {
      await disconnectSession(sessionId);
      removeConnection(sessionId);
      cookieStore.delete("db-session");
    }
    cookieStore.delete("db-config");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Disconnect failed" },
      { status: 500 }
    );
  }
}
