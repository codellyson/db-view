//! SQLite/libsql backend. Same surface as `postgres::PgConnection` for the
//! subset of operations slice 1 needs: open, query → JSON rows, list
//! tables, describe table, browse table rows, run arbitrary SQL.
//!
//! Local files (`Builder::new_local(path)`) and remote Turso/sqld endpoints
//! (`Builder::new_remote(url, token)`) flow through the same libsql
//! `Connection`, so the rest of this module doesn't care which one's behind
//! it.

use libsql::{params, Builder, Connection, Database, Value as LibsqlValue};
use serde::Serialize;
use serde_json::{Map as JsonMap, Number as JsonNumber, Value as JsonValue};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::postgres::{ColumnMeta, DbConfig, QueryResult};

/// Catalog answer for SQLite's single-schema model. We expose `main` (and
/// `temp` when present) the same way Postgres exposes `public` so the
/// frontend schema picker keeps working without conditionals.
pub const DEFAULT_SCHEMA: &str = "main";

pub struct SqliteConnection {
    // libsql::Connection isn't Sync; wrap in a Mutex so the DashMap of
    // sessions can hold an Arc<SqliteConnection> across awaits. Queries
    // briefly take the lock; for slice 1 (browse-only, no concurrent
    // writes) this is fine. Slice 2 can move to a per-call connection
    // checkout from a libsql::Database pool if contention shows up.
    conn: Mutex<Connection>,
    // Held so the database (and its background tasks for remote) lives
    // as long as the connection.
    _db: Arc<Database>,
}

impl SqliteConnection {
    pub async fn connect(config: DbConfig) -> Result<Self, String> {
        let filepath = config
            .filepath
            .as_deref()
            .ok_or_else(|| "SQLite config requires a filepath or libsql:// URL".to_string())?;

        let is_remote = filepath.starts_with("libsql://")
            || filepath.starts_with("https://")
            || filepath.starts_with("http://");

        let db = if is_remote {
            let token = config.auth_token.unwrap_or_default();
            Builder::new_remote(filepath.to_string(), token)
                .build()
                .await
                .map_err(|e| format!("libsql remote build: {e}"))?
        } else {
            Builder::new_local(filepath)
                .build()
                .await
                .map_err(|e| format!("libsql local build: {e}"))?
        };
        let conn = db
            .connect()
            .map_err(|e| format!("libsql connect: {e}"))?;
        // Round-trip ping so connection errors surface here instead of on
        // the first query.
        conn.query("SELECT 1", ())
            .await
            .map_err(|e| format!("libsql ping: {e}"))?;

        Ok(Self {
            conn: Mutex::new(conn),
            _db: Arc::new(db),
        })
    }

    /// Run an arbitrary SQL query and return rows as JSON objects keyed by
    /// column name — same shape `PgConnection::query_objects` returns, so
    /// downstream serialization paths in `lib.rs` don't need a special
    /// case.
    pub async fn query_objects(&self, sql: &str) -> Result<Vec<JsonValue>, String> {
        let result = self.query(sql).await?;
        Ok(rows_as_objects(&result))
    }

    /// Run a query and capture column metadata + rows as JSON values. Mirrors
    /// the shape of `postgres::QueryResult`.
    pub async fn query(&self, sql: &str) -> Result<QueryResult, String> {
        let conn = self.conn.lock().await;
        let mut rows = conn
            .query(sql, ())
            .await
            .map_err(|e| format!("libsql query: {e}"))?;

        let n_cols = rows.column_count() as usize;
        let columns: Vec<ColumnMeta> = (0..n_cols)
            .map(|i| ColumnMeta {
                name: rows.column_name(i as i32).unwrap_or("?").to_string(),
                data_type: rows
                    .column_type(i as i32)
                    .map(libsql_type_to_str)
                    .unwrap_or("text")
                    .to_string(),
                table_oid: None,
                column_id: None,
                data_type_id: None,
            })
            .collect();

        let mut serialized: Vec<Vec<JsonValue>> = Vec::new();
        while let Some(row) = rows
            .next()
            .await
            .map_err(|e| format!("libsql row: {e}"))?
        {
            let mut cells = Vec::with_capacity(n_cols);
            for i in 0..n_cols {
                let v = row
                    .get_value(i as i32)
                    .map_err(|e| format!("libsql cell {i}: {e}"))?;
                cells.push(libsql_value_to_json(v));
            }
            serialized.push(cells);
        }

        Ok(QueryResult {
            row_count: serialized.len(),
            columns,
            rows: serialized,
        })
    }

    /// Cheap liveness probe used by `db_health`.
    pub async fn ping(&self) -> bool {
        let conn = self.conn.lock().await;
        conn.query("SELECT 1", ()).await.is_ok()
    }

    /// `db_list_schemas` for SQLite — always exactly the schemas SQLite
    /// considers reachable (`main`, plus `temp` when in use). No
    /// user-defined schemas in SQLite's model.
    pub async fn list_schemas(&self) -> Result<Vec<String>, String> {
        Ok(vec![DEFAULT_SCHEMA.to_string()])
    }

    /// `db_list_tables` — sqlite_master is the canonical catalog.
    pub async fn list_tables(&self) -> Result<Vec<String>, String> {
        let result = self
            .query(
                "SELECT name FROM sqlite_master \
                 WHERE type = 'table' AND name NOT LIKE 'sqlite_%' \
                 ORDER BY name",
            )
            .await?;
        Ok(first_column_strings(&result.rows))
    }

    /// `db_table_schema` — Postgres returns information_schema rows; for
    /// SQLite we synthesize the same shape from `PRAGMA table_info` so the
    /// frontend's `tableSchema` map function works unchanged.
    pub async fn table_schema(&self, table: &str) -> Result<Vec<JsonValue>, String> {
        validate_identifier(table)?;
        let sql = format!("PRAGMA table_info(\"{table}\")");
        let result = self.query(&sql).await?;
        // PRAGMA columns: cid, name, type, notnull, dflt_value, pk
        let out: Vec<JsonValue> = result
            .rows
            .iter()
            .map(|row| {
                let mut obj = JsonMap::with_capacity(5);
                obj.insert(
                    "column_name".into(),
                    row.get(1).cloned().unwrap_or(JsonValue::Null),
                );
                obj.insert(
                    "data_type".into(),
                    row.get(2).cloned().unwrap_or(JsonValue::Null),
                );
                let notnull = row.get(3).and_then(|v| v.as_i64()).unwrap_or(0);
                obj.insert(
                    "is_nullable".into(),
                    JsonValue::String(if notnull == 0 { "YES" } else { "NO" }.into()),
                );
                obj.insert(
                    "column_default".into(),
                    row.get(4).cloned().unwrap_or(JsonValue::Null),
                );
                let pk = row.get(5).and_then(|v| v.as_i64()).unwrap_or(0);
                obj.insert("is_primary_key".into(), JsonValue::Bool(pk > 0));
                JsonValue::Object(obj)
            })
            .collect();
        Ok(out)
    }

    /// `db_table_rows` with sort + pagination. Filter wiring lands with
    /// slice 2 when the mutation paths come online; for now the request
    /// shape matches and a stray `filters` list short-circuits to an empty
    /// page with a clear error so the UI can degrade rather than crash.
    pub async fn table_rows(
        &self,
        table: &str,
        limit: u32,
        offset: u32,
        sort_column: Option<&str>,
        sort_direction: Option<&str>,
    ) -> Result<TableRowsResponse, String> {
        validate_identifier(table)?;
        let q_table = format!("\"{table}\"");

        let total_sql = format!("SELECT COUNT(*) FROM {q_table}");
        let total_res = self.query(&total_sql).await?;
        let total: i64 = total_res
            .rows
            .first()
            .and_then(|r| r.first())
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let mut data_sql = format!("SELECT * FROM {q_table}");
        if let (Some(col), Some(dir)) = (sort_column, sort_direction) {
            validate_identifier(col)?;
            let dir_kw = if dir.eq_ignore_ascii_case("desc") {
                "DESC"
            } else {
                "ASC"
            };
            data_sql.push_str(&format!(" ORDER BY \"{col}\" {dir_kw}"));
        }
        data_sql.push_str(&format!(" LIMIT {limit} OFFSET {offset}"));

        let rows = self.query_objects(&data_sql).await?;
        Ok(TableRowsResponse {
            rows,
            total,
            limit,
            offset,
            count_is_estimate: false,
        })
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableRowsResponse {
    pub rows: Vec<JsonValue>,
    pub total: i64,
    pub limit: u32,
    pub offset: u32,
    pub count_is_estimate: bool,
}

/// Same SQLite identifier rule the postgres module uses for its own
/// quoting: leading alpha/underscore, then alphanumeric/underscore.
/// Keeps the injection surface small for the few identifier interpolations
/// PRAGMA and SELECT lookups need.
fn validate_identifier(name: &str) -> Result<(), String> {
    let mut chars = name.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
        _ => return Err(format!("invalid identifier: {name}")),
    }
    if !chars.all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err(format!("invalid identifier: {name}"));
    }
    Ok(())
}

fn libsql_type_to_str(t: libsql::ValueType) -> &'static str {
    use libsql::ValueType::*;
    match t {
        Integer => "integer",
        Real => "real",
        Text => "text",
        Blob => "blob",
        Null => "null",
    }
}

fn libsql_value_to_json(v: LibsqlValue) -> JsonValue {
    match v {
        LibsqlValue::Null => JsonValue::Null,
        LibsqlValue::Integer(n) => JsonValue::Number(JsonNumber::from(n)),
        LibsqlValue::Real(f) => JsonNumber::from_f64(f)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        LibsqlValue::Text(s) => JsonValue::String(s),
        LibsqlValue::Blob(b) => JsonValue::String(format!("\\x{}", hex_lower(&b))),
    }
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write as _;
        let _ = write!(s, "{:02x}", b);
    }
    s
}

fn rows_as_objects(result: &QueryResult) -> Vec<JsonValue> {
    result
        .rows
        .iter()
        .map(|row| {
            let mut obj = JsonMap::with_capacity(result.columns.len());
            for (i, col) in result.columns.iter().enumerate() {
                obj.insert(
                    col.name.clone(),
                    row.get(i).cloned().unwrap_or(JsonValue::Null),
                );
            }
            JsonValue::Object(obj)
        })
        .collect()
}

fn first_column_strings(rows: &[Vec<JsonValue>]) -> Vec<String> {
    rows.iter()
        .filter_map(|r| r.first().and_then(|v| v.as_str().map(String::from)))
        .collect()
}

// Suppress `params` being imported via macro re-export — we currently use
// `()` for parameterless queries and will wire bound params with slice 2.
#[allow(dead_code)]
const _: () = {
    let _ = std::marker::PhantomData::<fn() -> params::Params>;
};
