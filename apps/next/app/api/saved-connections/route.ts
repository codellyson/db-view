import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/security";
import { testConnection, createPool } from "@/lib/db";
import { storeConnection, generateSessionId } from "@/lib/connection-store";
import { DBConfig } from "@/types";

interface StoredSavedConnection {
  id: string;
  name: string;
  config: DBConfig;
  createdAt: number;
  lastUsed?: number;
}

const COOKIE_NAME = "db-saved-connections";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

async function getSavedConnections(): Promise<StoredSavedConnection[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return [];

  try {
    const decrypted = decrypt(raw);
    return JSON.parse(decrypted) as StoredSavedConnection[];
  } catch {
    return [];
  }
}

async function persistSavedConnections(
  connections: StoredSavedConnection[]
): Promise<void> {
  const cookieStore = await cookies();

  if (connections.length === 0) {
    cookieStore.delete(COOKIE_NAME);
    return;
  }

  const encrypted = encrypt(JSON.stringify(connections));
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
  });
}

function sanitizeForClient(conn: StoredSavedConnection) {
  return {
    id: conn.id,
    name: conn.name,
    config: {
      host: conn.config.host,
      port: conn.config.port,
      database: conn.config.database,
      username: conn.config.username,
      password: "", // never sent to client
      ssl: conn.config.ssl,
      type: conn.config.type,
      filepath: conn.config.filepath,
      authToken: undefined, // never sent to client
    },
    createdAt: conn.createdAt,
    lastUsed: conn.lastUsed,
  };
}

// GET: list saved connections (passwords stripped)
export async function GET() {
  try {
    const connections = await getSavedConnections();
    const safe = connections.map(sanitizeForClient);
    return NextResponse.json({ connections: safe });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load saved connections" },
      { status: 500 }
    );
  }
}

// POST: save a new connection
export async function POST(request: NextRequest) {
  try {
    const { id, name, config } = (await request.json()) as {
      id: string;
      name: string;
      config: DBConfig;
    };

    if (!id || !name || !config) {
      return NextResponse.json(
        { error: "id, name, and config are required" },
        { status: 400 }
      );
    }

    const connections = await getSavedConnections();
    const newConnection: StoredSavedConnection = {
      id,
      name,
      config,
      createdAt: Date.now(),
    };

    connections.push(newConnection);
    await persistSavedConnections(connections);

    return NextResponse.json({
      connection: sanitizeForClient(newConnection),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save connection" },
      { status: 500 }
    );
  }
}

// DELETE: remove a saved connection
export async function DELETE(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id: string };

    if (!id) {
      return NextResponse.json(
        { error: "Connection id is required" },
        { status: 400 }
      );
    }

    const connections = await getSavedConnections();
    const filtered = connections.filter((c) => c.id !== id);
    await persistSavedConnections(filtered);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete connection" },
      { status: 500 }
    );
  }
}

// PATCH: connect to a saved connection by ID (password never leaves the server)
export async function PATCH(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id: string };

    if (!id) {
      return NextResponse.json(
        { error: "Connection id is required" },
        { status: 400 }
      );
    }

    const connections = await getSavedConnections();
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    const config = connection.config;
    const dbType = config.type || "postgresql";

    // Test & create pool server-side using credentials from the encrypted cookie
    try {
      await testConnection(config, dbType);
    } catch (connErr: any) {
      return NextResponse.json(
        { error: connErr.message || "Failed to connect to database" },
        { status: 400 }
      );
    }

    createPool(config, dbType);

    // Set session cookies
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

    // Update lastUsed
    connection.lastUsed = Date.now();
    await persistSavedConnections(connections);

    return NextResponse.json({
      success: true,
      database: config.database,
      type: dbType,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to connect" },
      { status: 500 }
    );
  }
}
