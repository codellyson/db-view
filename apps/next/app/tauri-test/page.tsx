"use client";

import { useState } from "react";

type ConnectResponse = {
  session_id: string;
  database: string;
};

type ColumnMeta = {
  name: string;
  type: string;
};

type QueryResult = {
  columns: ColumnMeta[];
  rows: unknown[][];
  row_count: number;
};

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

async function getInvoke(): Promise<InvokeFn | null> {
  if (typeof window === "undefined") return null;
  // In a non-Tauri environment, this module either isn't loadable or returns
  // a function that throws. We surface that cleanly to the UI.
  try {
    const mod = await import("@tauri-apps/api/core");
    return mod.invoke as InvokeFn;
  } catch {
    return null;
  }
}

export default function TauriTestPage() {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState("postgres");
  const [username, setUsername] = useState("postgres");
  const [password, setPassword] = useState("");
  const [ssl, setSsl] = useState(false);
  const [sql, setSql] = useState("SELECT 1 AS one, now() AS at, 'hello' AS greeting");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleConnect() {
    setStatus("");
    setBusy(true);
    try {
      const invoke = await getInvoke();
      if (!invoke) {
        setStatus("Tauri API not available — open this page from the Tauri dev window (pnpm tauri:dev), not a regular browser.");
        return;
      }
      const res = await invoke<ConnectResponse>("db_connect", {
        config: { host, port, database, username, password, ssl },
      });
      setSessionId(res.session_id);
      setStatus(`Connected to ${res.database} (session ${res.session_id.slice(0, 8)}…)`);
    } catch (e: unknown) {
      setStatus(`Connect failed: ${formatErr(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleQuery() {
    if (!sessionId) {
      setStatus("Connect first.");
      return;
    }
    setStatus("");
    setBusy(true);
    try {
      const invoke = await getInvoke();
      if (!invoke) {
        setStatus("Tauri API not available.");
        return;
      }
      const res = await invoke<QueryResult>("db_query", {
        sessionId,
        sql,
      });
      setResult(res);
      setStatus(`Returned ${res.row_count} row(s).`);
    } catch (e: unknown) {
      setStatus(`Query failed: ${formatErr(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!sessionId) return;
    try {
      const invoke = await getInvoke();
      if (!invoke) return;
      await invoke("db_disconnect", { sessionId });
      setSessionId(null);
      setResult(null);
      setStatus("Disconnected.");
    } catch (e: unknown) {
      setStatus(`Disconnect failed: ${formatErr(e)}`);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 960 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Tauri spike</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Sanity check: prove the Tauri webview can talk to a Rust command that opens a real Postgres connection.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, marginBottom: 16 }}>
        <label>Host</label>
        <input value={host} onChange={(e) => setHost(e.target.value)} />
        <label>Port</label>
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(Number(e.target.value))}
        />
        <label>Database</label>
        <input value={database} onChange={(e) => setDatabase(e.target.value)} />
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label>SSL</label>
        <input
          type="checkbox"
          checked={ssl}
          onChange={(e) => setSsl(e.target.checked)}
        />
      </section>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={handleConnect} disabled={busy}>
          {sessionId ? "Reconnect" : "Connect"}
        </button>
        <button onClick={handleDisconnect} disabled={busy || !sessionId}>
          Disconnect
        </button>
      </div>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 4 }}>SQL</label>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={4}
          style={{ width: "100%", fontFamily: "ui-monospace, monospace" }}
        />
        <button onClick={handleQuery} disabled={busy || !sessionId} style={{ marginTop: 8 }}>
          Run query
        </button>
      </section>

      {status && (
        <pre
          style={{
            background: "#f5f5f5",
            padding: 12,
            borderRadius: 4,
            whiteSpace: "pre-wrap",
            marginBottom: 16,
          }}
        >
          {status}
        </pre>
      )}

      {result && (
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Result</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th
                    key={c.name}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #ccc",
                      padding: "4px 8px",
                    }}
                  >
                    {c.name}
                    <div style={{ color: "#888", fontSize: 11, fontWeight: 400 }}>
                      {c.type}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        borderBottom: "1px solid #eee",
                        padding: "4px 8px",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 12,
                      }}
                    >
                      {cell === null ? <em style={{ color: "#999" }}>null</em> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function formatErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyE = e as { message?: string; kind?: string };
    if (anyE.message) return `${anyE.kind ? `[${anyE.kind}] ` : ""}${anyE.message}`;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
