//! Stdio MCP server mode: `justdb --mcp-serve`.
//!
//! A local CLI agent (e.g. Claude Code) spawns this as a Model Context Protocol
//! server so it can call back into the connected database with read-only tools.
//! The agent drives its own loop; this process only answers JSON-RPC tool calls
//! over stdin/stdout (newline-delimited, MCP stdio transport).
//!
//! The connection is *reopened* here from a serialized [`DbConfig`] passed in
//! via the `JUSTDB_MCP_CONFIG` environment variable (never written to disk —
//! the parent injects it through the spawned agent's env). This is a second,
//! read-only session; `run_sql` still passes through [`ai::is_read_only`], the
//! same gate the in-app agent uses.

use crate::ai::{self, SqlRunner};
use crate::postgres::{DbConfig, DbType, PgConnection};
use crate::sqlite::SqliteConnection;
use serde_json::{json, Value};
use std::io::Write;
use tokio::io::{AsyncBufReadExt, BufReader};

const PROTOCOL_VERSION: &str = "2024-11-05";
/// Env var carrying the serialized `DbConfig` for the connection to reopen.
pub const CONFIG_ENV: &str = "JUSTDB_MCP_CONFIG";

/// A [`SqlRunner`] over a freshly reopened, read-only connection.
enum ReopenedRunner {
    Pg(PgConnection),
    Sqlite(SqliteConnection),
}

#[async_trait::async_trait]
impl SqlRunner for ReopenedRunner {
    async fn run_readonly(&self, sql: &str) -> Result<Vec<Value>, String> {
        match self {
            ReopenedRunner::Pg(pg) => {
                pg.query_objects(sql, &[]).await.map_err(|e| e.to_string())
            }
            ReopenedRunner::Sqlite(sq) => sq.query_objects_isolated(sql).await,
        }
    }
}

/// The four read-only DB tools, advertised via `tools/list`. Schemas and
/// descriptions are shared with the in-app agent (`ai.rs`) so both surfaces
/// expose identical tools.
fn tool_defs() -> Value {
    json!([
        { "name": "run_sql",        "description": ai::RUN_SQL_DESC,        "inputSchema": ai::run_sql_params() },
        { "name": "list_tables",    "description": ai::LIST_TABLES_DESC,    "inputSchema": ai::no_params() },
        { "name": "describe_table", "description": ai::DESCRIBE_TABLE_DESC, "inputSchema": ai::describe_params() },
        { "name": "propose_write",  "description": ai::PROPOSE_DESC,        "inputSchema": ai::propose_params() },
    ])
}

/// Write one JSON-RPC message to stdout, newline-terminated and flushed.
fn send(v: &Value) {
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "{v}");
    let _ = out.flush();
}

/// Handle one incoming JSON-RPC message. Returns the response to send, or
/// `None` for notifications (no `id`) which get no reply.
async fn handle(msg: &Value, runner: &dyn SqlRunner, dialect: &str) -> Option<Value> {
    let id = msg.get("id").cloned();
    let method = msg.get("method").and_then(|m| m.as_str()).unwrap_or("");
    match method {
        "initialize" => Some(json!({
            "jsonrpc": "2.0", "id": id,
            "result": {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "justdb", "version": env!("CARGO_PKG_VERSION") }
            }
        })),
        // Notifications — no response.
        m if m.starts_with("notifications/") => None,
        "ping" => Some(json!({ "jsonrpc": "2.0", "id": id, "result": {} })),
        "tools/list" => Some(json!({
            "jsonrpc": "2.0", "id": id,
            "result": { "tools": tool_defs() }
        })),
        "tools/call" => {
            let params = msg.get("params").cloned().unwrap_or_else(|| json!({}));
            let name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            let payload = ai::exec_tool_body(name, &args, runner, dialect).await;
            let is_error = payload.get("error").is_some();
            Some(json!({
                "jsonrpc": "2.0", "id": id,
                "result": {
                    "content": [ { "type": "text", "text": payload.to_string() } ],
                    "isError": is_error
                }
            }))
        }
        // Unknown request → error; unknown notification (no id) → silence.
        _ => id.as_ref().map(|_| json!({
            "jsonrpc": "2.0", "id": id,
            "error": { "code": -32601, "message": format!("method not found: {method}") }
        })),
    }
}

/// Reopen the connection from `JUSTDB_MCP_CONFIG` and run the JSON-RPC loop
/// until stdin closes. Invoked from `run()` when the binary is started as
/// `justdb --mcp-serve`.
pub async fn serve_stdio() -> Result<(), String> {
    let cfg_json =
        std::env::var(CONFIG_ENV).map_err(|_| format!("{CONFIG_ENV} not set"))?;
    let config: DbConfig =
        serde_json::from_str(&cfg_json).map_err(|e| format!("invalid {CONFIG_ENV}: {e}"))?;
    let dialect = if matches!(config.db_type, DbType::Sqlite) {
        "sqlite"
    } else {
        "postgresql"
    };
    let runner: Box<dyn SqlRunner> = if dialect == "sqlite" {
        Box::new(ReopenedRunner::Sqlite(
            SqliteConnection::connect(config)
                .await
                .map_err(|e| format!("reopen connection: {e}"))?,
        ))
    } else {
        Box::new(ReopenedRunner::Pg(
            PgConnection::connect(config)
                .await
                .map_err(|e| format!("reopen connection: {e}"))?,
        ))
    };

    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Some(line) = lines.next_line().await.map_err(|e| e.to_string())? {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(msg) = serde_json::from_str::<Value>(line) else {
            continue; // skip malformed frames rather than tearing down the loop
        };
        if let Some(resp) = handle(&msg, runner.as_ref(), dialect).await {
            send(&resp);
        }
    }
    Ok(())
}
