import { NextRequest, NextResponse } from "next/server";
import { testConnection, createPool, setPool } from "@/lib/db";
import { storeConnection, generateSessionId } from "@/lib/connection-store";
import { DBConfig } from "@/types";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const config: DBConfig = await request.json();

    const isValid = await testConnection(config);
    if (!isValid) {
      return NextResponse.json(
        { error: "Failed to connect to database" },
        { status: 400 }
      );
    }

    const pool = createPool(config);
    setPool(pool, config);

    const sessionId = generateSessionId();
    storeConnection(sessionId, config);

    const cookieStore = await cookies();
    cookieStore.set("db-session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
    });

    const configJson = JSON.stringify(config);
    const configBase64 = Buffer.from(configJson).toString("base64");
    cookieStore.set("db-config", configBase64, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
    });

    console.log("Pool created and set successfully with config and session");

    return NextResponse.json({ success: true, database: config.database });
  } catch (error: any) {
    console.error("Connection failed:", error);
    return NextResponse.json(
      { error: error.message || "Connection failed" },
      { status: 500 }
    );
  }
}
