mod postgres;

use dashmap::DashMap;
use postgres::{DbConfig, PgConnection, QueryResult};
use serde::Serialize;
use serde_json::Value as JsonValue;
use std::sync::Arc;
use tauri::{Manager, State};

#[derive(Default)]
struct AppState {
    // session_id -> live Postgres connection
    sessions: DashMap<String, Arc<PgConnection>>,
}

#[derive(Debug, Serialize, thiserror::Error)]
#[serde(tag = "kind", content = "message")]
enum CommandError {
    #[error("{0}")]
    Connection(String),
    #[error("{0}")]
    Query(String),
    #[error("no session: {0}")]
    NoSession(String),
}

type CommandResult<T> = Result<T, CommandError>;

#[derive(Serialize)]
struct ConnectResponse {
    session_id: String,
    database: String,
}

#[tauri::command]
async fn db_connect(
    config: DbConfig,
    state: State<'_, AppState>,
) -> CommandResult<ConnectResponse> {
    let database = config.database.clone();
    let conn = PgConnection::connect(config)
        .await
        .map_err(|e| CommandError::Connection(e.to_string()))?;

    let session_id = uuid::Uuid::new_v4().to_string();
    state.sessions.insert(session_id.clone(), Arc::new(conn));

    Ok(ConnectResponse {
        session_id,
        database,
    })
}

#[tauri::command]
async fn db_query(
    session_id: String,
    sql: String,
    state: State<'_, AppState>,
) -> CommandResult<QueryResult> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    conn.query(&sql)
        .await
        .map_err(|e| CommandError::Query(e.to_string()))
}

#[tauri::command]
async fn db_disconnect(session_id: String, state: State<'_, AppState>) -> CommandResult<()> {
    state.sessions.remove(&session_id);
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    healthy: bool,
    latency: Option<u64>,
    active_connections: u32,
    idle_connections: u32,
}

#[tauri::command]
async fn db_health(
    session_id: String,
    state: State<'_, AppState>,
) -> CommandResult<HealthResponse> {
    // Health never returns Err — the SaaS route also returns 200 with
    // `healthy: false` when there's no pool, so the hook just inspects the body.
    let conn = state.sessions.get(&session_id).map(|entry| entry.clone());
    let Some(conn) = conn else {
        return Ok(HealthResponse {
            healthy: false,
            latency: None,
            active_connections: 0,
            idle_connections: 0,
        });
    };

    let start = std::time::Instant::now();
    match conn.query("SELECT 1").await {
        Ok(_) => Ok(HealthResponse {
            healthy: true,
            latency: Some(start.elapsed().as_millis() as u64),
            active_connections: 1,
            idle_connections: 0,
        }),
        Err(_) => Ok(HealthResponse {
            healthy: false,
            latency: None,
            active_connections: 0,
            idle_connections: 0,
        }),
    }
}

#[tauri::command]
async fn db_list_schemas(
    session_id: String,
    state: State<'_, AppState>,
) -> CommandResult<Vec<String>> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let res = conn
        .query(
            "SELECT schema_name
             FROM information_schema.schemata
             WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
             ORDER BY schema_name",
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(first_column_strings(&res.rows))
}

#[tauri::command]
async fn db_list_tables(
    session_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<Vec<String>> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let res = conn
        .query_with_params(
            "SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = $1 AND table_type = 'BASE TABLE'
             ORDER BY table_name",
            &[schema],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(first_column_strings(&res.rows))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TableRowsResponse {
    rows: Vec<JsonValue>,
    total: i64,
    limit: u32,
    offset: u32,
    count_is_estimate: bool,
}

#[tauri::command]
async fn db_table_rows(
    session_id: String,
    table: String,
    schema: String,
    limit: u32,
    offset: u32,
    sort_column: Option<String>,
    sort_direction: Option<String>,
    state: State<'_, AppState>,
) -> CommandResult<TableRowsResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let q_schema = postgres::quote_identifier(&schema).map_err(CommandError::Query)?;
    let q_table = postgres::quote_identifier(&table).map_err(CommandError::Query)?;
    let qualified = format!("{q_schema}.{q_table}");

    // Estimate via pg_class.reltuples; fall back to exact COUNT(*) when small.
    // reltuples returns -1 for never-analyzed tables, which fails the >10k
    // threshold and correctly falls through to the COUNT(*) branch.
    let est = conn
        .query_with_params(
            "SELECT reltuples::bigint AS estimate
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = $1 AND n.nspname = $2",
            &[table.clone(), schema.clone()],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;
    let estimate: i64 = est
        .rows
        .first()
        .and_then(|r| r.first())
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    let (total, count_is_estimate) = if estimate > 10_000 {
        (estimate, true)
    } else {
        let c = conn
            .query(&format!("SELECT COUNT(*) AS count FROM {qualified}"))
            .await
            .map_err(|e| CommandError::Query(e.to_string()))?;
        let n: i64 = c
            .rows
            .first()
            .and_then(|r| r.first())
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        (n, false)
    };

    let mut data_sql = format!("SELECT * FROM {qualified}");
    if let (Some(col), Some(dir)) = (sort_column.as_deref(), sort_direction.as_deref()) {
        let q_col = postgres::quote_identifier(col).map_err(CommandError::Query)?;
        let dir_kw = if dir.eq_ignore_ascii_case("desc") { "DESC" } else { "ASC" };
        data_sql.push_str(&format!(" ORDER BY {q_col} {dir_kw}"));
    }
    data_sql.push_str(&format!(" LIMIT {limit} OFFSET {offset}"));

    let rows = conn
        .query_objects(&data_sql, &[])
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(TableRowsResponse {
        rows,
        total,
        limit,
        offset,
        count_is_estimate,
    })
}

fn first_column_strings(rows: &[Vec<JsonValue>]) -> Vec<String> {
    rows.iter()
        .filter_map(|r| r.first().and_then(|v| v.as_str().map(String::from)))
        .collect()
}

#[tauri::command]
async fn db_table_schema(
    session_id: String,
    table: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<Vec<JsonValue>> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    // Same query the SaaS postgresql provider uses (lib/providers/postgresql.ts
    // getTableSchema). Columns + the PK flag in one round-trip.
    conn.query_objects(
        "SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
         FROM information_schema.columns c
         LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            WHERE tc.table_name = $1
              AND tc.table_schema = $2
              AND tc.constraint_type = 'PRIMARY KEY'
         ) pk ON c.column_name = pk.column_name
         WHERE c.table_name = $1
           AND c.table_schema = $2
         ORDER BY c.ordinal_position",
        &[table, schema],
    )
    .await
    .map_err(|e| CommandError::Query(e.to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(AppState::default());
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_connect,
            db_query,
            db_disconnect,
            db_health,
            db_list_schemas,
            db_list_tables,
            db_table_rows,
            db_table_schema,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
