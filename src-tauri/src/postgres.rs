use serde::{Deserialize, Serialize};
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_postgres::{
    types::{FromSql, ToSql, Type},
    Client, Row,
};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DbConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub ssl: bool,
}

#[derive(Debug, Serialize)]
pub struct ColumnMeta {
    pub name: String,
    #[serde(rename = "type")]
    pub data_type: String,
    // Postgres OIDs from the prepared statement's row description. Used by
    // db_run_query to resolve back to base-table (schema, table, column) so
    // the SQL editor's result rows can hand off to the FK navigator. None
    // when the column isn't backed by a table (literals, expressions).
    #[serde(rename = "tableOid", skip_serializing_if = "Option::is_none")]
    pub table_oid: Option<u32>,
    #[serde(rename = "columnId", skip_serializing_if = "Option::is_none")]
    pub column_id: Option<i16>,
    #[serde(rename = "dataTypeId", skip_serializing_if = "Option::is_none")]
    pub data_type_id: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnMeta>,
    pub rows: Vec<Vec<JsonValue>>,
    pub row_count: usize,
}

pub struct PgConnection {
    // tokio-postgres Client is Sync and designed for concurrent queries on a
    // single connection (it pipelines internally). Wrapping it in a Mutex
    // would serialize them and — worse — leave the connection in a bad state
    // if a future holding the lock is cancelled mid-query. We keep an
    // Arc<Client> behind a brief Mutex only so reconnect can swap it.
    client: Mutex<Arc<Client>>,
    config: DbConfig,
}

impl PgConnection {
    pub async fn connect(config: DbConfig) -> Result<Self, tokio_postgres::Error> {
        let client = Self::open_client(&config).await?;
        Ok(Self {
            client: Mutex::new(Arc::new(client)),
            config,
        })
    }

    async fn open_client(config: &DbConfig) -> Result<Client, tokio_postgres::Error> {
        let mut pg_config = tokio_postgres::Config::new();
        pg_config
            .host(&config.host)
            .port(config.port)
            .dbname(&config.database)
            .user(&config.username)
            .password(&config.password);

        // The TLS and NoTls Connection types differ, so each branch must spawn
        // its own driver task. Both branches yield a Client, which has the
        // same type regardless of the transport.
        let client = if config.ssl {
            let tls_connector = native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .expect("failed to build TLS connector");
            let connector = postgres_native_tls::MakeTlsConnector::new(tls_connector);
            let (client, connection) = pg_config.connect(connector).await?;
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    log::error!("postgres connection error: {e}");
                }
            });
            client
        } else {
            let (client, connection) = pg_config.connect(tokio_postgres::NoTls).await?;
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    log::error!("postgres connection error: {e}");
                }
            });
            client
        };
        Ok(client)
    }

    async fn current_client(&self) -> Arc<Client> {
        self.client.lock().await.clone()
    }

    async fn force_reconnect(&self) -> Result<Arc<Client>, tokio_postgres::Error> {
        // Open the new connection without holding the lock — TLS + auth is
        // hundreds of ms. Brief race where two callers both reconnect; the
        // last writer wins, the loser's Client is dropped.
        let new_client = Arc::new(Self::open_client(&self.config).await?);
        let mut guard = self.client.lock().await;
        *guard = new_client.clone();
        Ok(new_client)
    }

    pub async fn query(&self, sql: &str) -> Result<QueryResult, tokio_postgres::Error> {
        self.query_with_params(sql, &[]).await
    }

    pub async fn query_with_params(
        &self,
        sql: &str,
        params: &[Option<String>],
    ) -> Result<QueryResult, tokio_postgres::Error> {
        let client = self.current_client().await;
        match Self::run_query(&client, sql, params).await {
            Err(e) if is_connection_closed(&e) => {
                let new_client = self.force_reconnect().await?;
                Self::run_query(&new_client, sql, params).await
            }
            other => other,
        }
    }

    async fn run_query(
        client: &Client,
        sql: &str,
        params: &[Option<String>],
    ) -> Result<QueryResult, tokio_postgres::Error> {
        let stmt = client.prepare(sql).await?;

        let columns: Vec<ColumnMeta> = stmt
            .columns()
            .iter()
            .map(|c| {
                let t_oid = c.table_oid();
                let c_id = c.column_id();
                ColumnMeta {
                    name: c.name().to_string(),
                    data_type: c.type_().name().to_string(),
                    // tokio-postgres returns 0 for "no table" / "no column"; surface
                    // that as None so downstream callers don't try to resolve OID 0.
                    table_oid: t_oid.filter(|&v| v != 0),
                    column_id: c_id.filter(|&v| v != 0),
                    data_type_id: Some(c.type_().oid()),
                }
            })
            .collect();

        let param_refs: Vec<&(dyn ToSql + Sync)> =
            params.iter().map(|p| p as &(dyn ToSql + Sync)).collect();
        let rows = client.query(&stmt, &param_refs).await?;

        let serialized: Vec<Vec<JsonValue>> = rows
            .iter()
            .map(|row| {
                (0..row.len())
                    .map(|i| postgres_value_to_json(row, i))
                    .collect()
            })
            .collect();

        Ok(QueryResult {
            row_count: serialized.len(),
            columns,
            rows: serialized,
        })
    }

    // Convenience: run a query and return rows as JSON objects keyed by column
    // name. Matches the row shape the dashboard expects from the SaaS pg driver.
    pub async fn query_objects(
        &self,
        sql: &str,
        params: &[Option<String>],
    ) -> Result<Vec<JsonValue>, tokio_postgres::Error> {
        let result = self.query_with_params(sql, params).await?;
        Ok(rows_as_objects(&result))
    }

    // Execute a statement that doesn't return rows (or whose returned rows
    // we don't care about). Returns the affected-row count. Used by UPDATE
    // and DELETE — INSERT uses query() because RETURNING * gives us the new row.
    pub async fn execute(
        &self,
        sql: &str,
        params: &[Option<String>],
    ) -> Result<u64, tokio_postgres::Error> {
        let client = self.current_client().await;
        match Self::run_execute(&client, sql, params).await {
            Err(e) if is_connection_closed(&e) => {
                let new_client = self.force_reconnect().await?;
                Self::run_execute(&new_client, sql, params).await
            }
            other => other,
        }
    }

    async fn run_execute(
        client: &Client,
        sql: &str,
        params: &[Option<String>],
    ) -> Result<u64, tokio_postgres::Error> {
        let stmt = client.prepare(sql).await?;
        let param_refs: Vec<&(dyn ToSql + Sync)> =
            params.iter().map(|p| p as &(dyn ToSql + Sync)).collect();
        client.execute(&stmt, &param_refs).await
    }

    // Run a sequence of statements inside a transaction. All succeed or all
    // roll back. tokio-postgres `Transaction` needs `&mut Client`, which is
    // incompatible with our `Arc<Client>` sharing model, so we open a fresh
    // dedicated client per batch. Expensive (TLS handshake) but desktop write
    // volume is low and correctness wins. Statements are full SQL with any
    // values already escaped and inlined — params aren't supported here.
    pub async fn run_transaction(
        &self,
        statements: &[String],
    ) -> Result<Vec<u64>, tokio_postgres::Error> {
        let mut tx_client = Self::open_client(&self.config).await?;
        let tx = tx_client.transaction().await?;
        let mut row_counts = Vec::with_capacity(statements.len());
        for sql in statements {
            let n = tx.execute(sql.as_str(), &[]).await?;
            row_counts.push(n);
        }
        tx.commit().await?;
        Ok(row_counts)
    }
}

pub fn rows_as_objects(result: &QueryResult) -> Vec<JsonValue> {
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

// Postgres identifier validator. Matches the same regex the TS providers use
// (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) — narrow on purpose to keep injection
// surfaces small. Quoted identifiers with arbitrary content aren't supported.
fn is_valid_identifier(name: &str) -> bool {
    let mut chars = name.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn quote_identifier(name: &str) -> Result<String, String> {
    if !is_valid_identifier(name) {
        return Err(format!("Invalid identifier: {name}"));
    }
    Ok(format!("\"{name}\""))
}

// Postgres SQL literal: single-quoted, embedded ' doubled. Assumes
// standard_conforming_strings=on (default since 9.1) — backslashes are
// literal, not escape characters.
pub fn pg_quote_literal(s: &str) -> String {
    let escaped = s.replace('\'', "''");
    format!("'{escaped}'")
}

// Stringify a JsonValue for use in a SQL literal. Numbers/bools become their
// textual form, strings pass through, arrays/objects serialize as JSON text.
// Postgres coerces text → column type at parse time (same as the Node pg
// driver's default unknown-typed-param behavior).
pub fn json_to_text(val: &JsonValue) -> String {
    match val {
        JsonValue::Null => String::new(),
        JsonValue::String(s) => s.clone(),
        JsonValue::Bool(b) => b.to_string(),
        JsonValue::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

fn is_connection_closed(err: &tokio_postgres::Error) -> bool {
    let s = err.to_string().to_lowercase();
    s.contains("connection closed")
        || s.contains("connection is closed")
        || s.contains("connection reset")
        || s.contains("broken pipe")
}

// Converts a single column of a tokio_postgres Row into serde_json::Value.
// Unknown / unsupported types degrade to a string representation rather than failing the query.
fn postgres_value_to_json(row: &Row, idx: usize) -> JsonValue {
    let col_type = row.columns()[idx].type_();

    match *col_type {
        Type::BOOL => row
            .try_get::<_, Option<bool>>(idx)
            .ok()
            .flatten()
            .map(JsonValue::Bool)
            .unwrap_or(JsonValue::Null),
        Type::INT2 => row
            .try_get::<_, Option<i16>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::from(v as i64))
            .unwrap_or(JsonValue::Null),
        Type::INT4 => row
            .try_get::<_, Option<i32>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::from(v as i64))
            .unwrap_or(JsonValue::Null),
        Type::INT8 => row
            .try_get::<_, Option<i64>>(idx)
            .ok()
            .flatten()
            .map(JsonValue::from)
            .unwrap_or(JsonValue::Null),
        Type::FLOAT4 => row
            .try_get::<_, Option<f32>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::from(v as f64))
            .unwrap_or(JsonValue::Null),
        Type::FLOAT8 => row
            .try_get::<_, Option<f64>>(idx)
            .ok()
            .flatten()
            .map(JsonValue::from)
            .unwrap_or(JsonValue::Null),
        Type::TEXT | Type::VARCHAR | Type::BPCHAR | Type::NAME => row
            .try_get::<_, Option<String>>(idx)
            .ok()
            .flatten()
            .map(JsonValue::String)
            .unwrap_or(JsonValue::Null),
        Type::JSON | Type::JSONB => row
            .try_get::<_, Option<JsonValue>>(idx)
            .ok()
            .flatten()
            .unwrap_or(JsonValue::Null),
        Type::UUID => row
            .try_get::<_, Option<uuid::Uuid>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),
        Type::TIMESTAMP => row
            .try_get::<_, Option<chrono::NaiveDateTime>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),
        Type::TIMESTAMPTZ => row
            .try_get::<_, Option<chrono::DateTime<chrono::Utc>>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_rfc3339()))
            .unwrap_or(JsonValue::Null),
        Type::DATE => row
            .try_get::<_, Option<chrono::NaiveDate>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),
        Type::NUMERIC => row
            .try_get::<_, Option<rust_decimal::Decimal>>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),
        _ => {
            // Permissive fallback for types we don't decode explicitly
            // (custom enums, geometric types, intervals, ranges, arrays …).
            // tokio-postgres's String::accepts() only allows TEXT/VARCHAR/
            // BPCHAR/NAME, so the previous Option<String> branch silently
            // failed for everything else and rendered NULL. AnyAsString
            // accepts any type and reads the raw bytes as UTF-8 — correct
            // for enum labels, "good enough" for other types (the user sees
            // the text representation instead of a misleading NULL).
            match row.try_get::<_, Option<AnyAsString>>(idx) {
                Ok(Some(AnyAsString(Some(s)))) => JsonValue::String(s),
                _ => JsonValue::Null,
            }
        }
    }
}

// Permissive FromSql wrapper. accepts(_) returns true so tokio-postgres lets
// the caller bind to any type; the bytes are decoded as lossy UTF-8.
struct AnyAsString(Option<String>);

impl<'a> FromSql<'a> for AnyAsString {
    fn from_sql(
        _ty: &Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        Ok(AnyAsString(Some(String::from_utf8_lossy(raw).into_owned())))
    }

    fn accepts(_ty: &Type) -> bool {
        true
    }

    fn from_sql_null(_ty: &Type) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        Ok(AnyAsString(None))
    }
}

// Suppress unused-import warning when no FromSql-using types are added later.
#[allow(dead_code)]
fn _ensure_traits<T: for<'a> FromSql<'a>>() {}
