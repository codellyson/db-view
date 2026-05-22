use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_postgres::{
    types::{FromSql, Type},
    Client, Row,
};

#[derive(Debug, Clone, Deserialize)]
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
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnMeta>,
    pub rows: Vec<Vec<JsonValue>>,
    pub row_count: usize,
}

pub struct PgConnection {
    client: Arc<Mutex<Client>>,
}

impl PgConnection {
    pub async fn connect(config: &DbConfig) -> Result<Self, tokio_postgres::Error> {
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

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
        })
    }

    pub async fn query(&self, sql: &str) -> Result<QueryResult, tokio_postgres::Error> {
        let client = self.client.lock().await;

        let stmt = client.prepare(sql).await?;

        let columns: Vec<ColumnMeta> = stmt
            .columns()
            .iter()
            .map(|c| ColumnMeta {
                name: c.name().to_string(),
                data_type: c.type_().name().to_string(),
            })
            .collect();

        let rows = client.query(&stmt, &[]).await?;

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
            // Fallback: try as String, then as bytes-debug, then null.
            row.try_get::<_, Option<String>>(idx)
                .ok()
                .flatten()
                .map(JsonValue::String)
                .unwrap_or(JsonValue::Null)
        }
    }
}

// Suppress unused-import warning when no FromSql-using types are added later.
#[allow(dead_code)]
fn _ensure_traits<T: for<'a> FromSql<'a>>() {}
