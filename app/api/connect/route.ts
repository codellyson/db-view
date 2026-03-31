import { NextRequest, NextResponse } from "next/server";
import { testConnection, createPool } from "@/lib/db";
import { storeConnection, generateSessionId } from "@/lib/connection-store";
import { encrypt, decrypt, validateInput } from "@/lib/security";
import { DBConfig } from "@/types";
import { cookies } from "next/headers";

const SAVED_COOKIE = "db-saved-connections";
const SAVED_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

interface StoredSavedConnection {
  id: string;
  name: string;
  config: DBConfig;
  createdAt: number;
  lastUsed?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: DBConfig = body.config ?? body;
    const saveName: string | undefined = body.saveName;
    const saveId: string | undefined = body.saveId;

    const dbType = config.type || "postgresql";

    // SQLite only needs a file path
    if (dbType === "sqlite") {
      if (!config.filepath) {
        return NextResponse.json(
          { error: "SQLite file path is required" },
          { status: 400 }
        );
      }
    } else {
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
    }

    try {
      await testConnection(config, dbType);
    } catch (connErr: any) {
      return NextResponse.json(
        { error: connErr.message || "Failed to connect to database" },
        { status: 400 }
      );
    }

    createPool(config, dbType);

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

    // If saveName is provided, also persist to saved-connections cookie
    let savedConnection;
    if (saveName && saveId) {
      let existing: StoredSavedConnection[] = [];
      const raw = cookieStore.get(SAVED_COOKIE)?.value;
      if (raw) {
        try {
          existing = JSON.parse(decrypt(raw));
        } catch { /* start fresh */ }
      }

      const newConn: StoredSavedConnection = {
        id: saveId,
        name: saveName,
        config,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
      existing.push(newConn);

      cookieStore.set(SAVED_COOKIE, encrypt(JSON.stringify(existing)), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SAVED_COOKIE_MAX_AGE,
      });

      // Return sanitized connection (no password) for client state
      savedConnection = {
        id: newConn.id,
        name: newConn.name,
        config: {
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: "",
          ssl: config.ssl,
          type: config.type,
          filepath: config.filepath,
        },
        createdAt: newConn.createdAt,
        lastUsed: newConn.lastUsed,
      };
    }

    return NextResponse.json({
      success: true,
      database: config.database,
      type: dbType,
      savedConnection,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Connection failed" },
      { status: 500 }
    );
  }
}
