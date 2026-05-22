mod postgres;

use dashmap::DashMap;
use postgres::{DbConfig, PgConnection, QueryResult};
use serde::Serialize;
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
    let conn = PgConnection::connect(&config)
        .await
        .map_err(|e| CommandError::Connection(e.to_string()))?;

    let session_id = uuid::Uuid::new_v4().to_string();
    state.sessions.insert(session_id.clone(), Arc::new(conn));

    Ok(ConnectResponse {
        session_id,
        database: config.database,
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
        .invoke_handler(tauri::generate_handler![db_connect, db_query, db_disconnect])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
