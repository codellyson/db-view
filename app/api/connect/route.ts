import { NextRequest, NextResponse } from "next/server";
import { testConnection, createPool } from "@/lib/db";
import { storeConnection, generateSessionId } from "@/lib/connection-store";
import { encrypt, decrypt, validateInput } from "@/lib/security";
import { connectLimiter } from "@/lib/rate-limit";
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
  // Rate limit by IP — no session cookie exists yet at connect time.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rl = connectLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many connection attempts. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  try {
    const body = await request.json();
    const config: DBConfig = body.config ?? body;
    const saveName: string | undefined = body.saveName;
    const saveId: string | undefined = body.saveId;

    const dbType = config.type || "postgresql";

    // SQLite / libsql
    if (dbType === "sqlite") {
      if (!config.filepath) {
        return NextResponse.json(
          { error: "SQLite connection URL or file path is required" },
          { status: 400 }
        );
      }

      const isRemote = /^(libsql|https?|wss?):\/\//i.test(config.filepath);

      if (isRemote) {
        // Remote libsql / Turso — same security model as Postgres/MySQL.
        // The URL points to a remote database with its own auth, not our
        // filesystem. Allow it unconditionally.
      } else {
        // Local file path — this reads from the server's disk.
        // Block entirely on hosted deployments.
        if (process.env.DBVIEW_DISABLE_LOCAL_SQLITE === "true") {
          return NextResponse.json(
            { error: "Local SQLite file connections are disabled on this server. Use a Turso/libsql URL, PostgreSQL, or MySQL instead." },
            { status: 403 }
          );
        }

        // Path traversal guard: reject absolute paths and ../ sequences
        // unless an explicit base directory is configured.
        const baseDir = process.env.DBVIEW_SQLITE_BASE_DIR;
        if (baseDir) {
          const path = await import("path");
          const resolved = path.resolve(baseDir, config.filepath);
          if (!resolved.startsWith(path.resolve(baseDir))) {
            return NextResponse.json(
              { error: "SQLite file path is outside the allowed directory" },
              { status: 400 }
            );
          }
          config.filepath = resolved;
        } else if (/^\/|^[A-Z]:\\|\.\.[\\/]/.test(config.filepath)) {
          return NextResponse.json(
            { error: "Absolute paths and directory traversal are not allowed for SQLite. Set DBVIEW_SQLITE_BASE_DIR on the server to allow specific directories." },
            { status: 400 }
          );
        }
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

    const sessionId = generateSessionId();
    storeConnection(sessionId, config);
    createPool(config, dbType, sessionId);

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
