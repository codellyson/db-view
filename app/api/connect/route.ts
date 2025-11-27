import { NextRequest, NextResponse } from "next/server";
import { testConnection, createPool, setPool } from "@/lib/db";
import { storeConnection, generateSessionId } from "@/lib/connection-store";
import { encrypt, validateInput } from "@/lib/security";
import { DBConfig } from "@/types";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const config: DBConfig = await request.json();

    const hostValidation = validateInput(config.host, "Host");
    if (!hostValidation.valid) {
      return NextResponse.json(
        { error: hostValidation.error },
        { status: 400 }
      );
    }

    const databaseValidation = validateInput(config.database, "Database");
    if (!databaseValidation.valid) {
      return NextResponse.json(
        { error: databaseValidation.error },
        { status: 400 }
      );
    }

    const usernameValidation = validateInput(config.username, "Username");
    if (!usernameValidation.valid) {
      return NextResponse.json(
        { error: usernameValidation.error },
        { status: 400 }
      );
    }

    if (config.port < 1 || config.port > 65535) {
      return NextResponse.json(
        { error: "Port must be between 1 and 65535" },
        { status: 400 }
      );
    }

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
      sameSite: "strict",
      maxAge: 24 * 60 * 60,
    });

    const configJson = JSON.stringify(config);
    const encryptedConfig = encrypt(configJson);
    cookieStore.set("db-config", encryptedConfig, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
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
