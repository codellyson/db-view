mod mutation;
mod postgres;
mod saved_connections;

use dashmap::DashMap;
use mutation::MutationRequest;
use postgres::{DbConfig, PgConnection, QueryResult};
use saved_connections::{ClientSavedConnection, SavedConnection};
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
            &[Some(schema)],
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
            &[Some(table.clone()), Some(schema.clone())],
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryField {
    name: String,
    data_type_id: Option<u32>,
    // FK source (which base-table column produced this output column) needs
    // pg_class/pg_attribute lookups via OIDs. The SaaS resolves this in
    // PostgreSQLProvider.resolveFieldSources; on desktop we surface `null`
    // for now — the FK-navigator on result rows just won't activate. Wire
    // when the polish phase has time.
    source: Option<()>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunQueryResponse {
    rows: Vec<JsonValue>,
    execution_time: u64,
    fields: Vec<QueryField>,
}

#[tauri::command]
async fn db_run_query(
    session_id: String,
    sql: String,
    state: State<'_, AppState>,
) -> CommandResult<RunQueryResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    // Match the SaaS executeQuery: 30s budget, return rows as objects keyed by
    // column name, plus per-column type OIDs so the editor can pick the right
    // renderer.
    let start = std::time::Instant::now();
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        conn.query(&sql),
    )
    .await
    .map_err(|_| CommandError::Query("Query timeout exceeded (30s)".into()))?
    .map_err(|e| CommandError::Query(e.to_string()))?;
    let execution_time = start.elapsed().as_millis() as u64;

    let fields: Vec<QueryField> = result
        .columns
        .iter()
        .map(|c| QueryField {
            name: c.name.clone(),
            // tokio-postgres exposes the type OID via `Type::oid()`; we need
            // to re-query that from the column metadata, but our QueryResult
            // only carries `data_type: String` (name). The pg_type name lookup
            // could resolve back to an OID via pg_type — skip for now and
            // emit None. The SQL editor falls back to text rendering.
            data_type_id: None,
            source: None,
        })
        .collect();

    let rows = postgres::rows_as_objects(&result);
    Ok(RunQueryResponse {
        rows,
        execution_time,
        fields,
    })
}

#[tauri::command]
async fn db_saved_list() -> CommandResult<Vec<ClientSavedConnection>> {
    saved_connections::list_sanitized().map_err(CommandError::Query)
}

#[tauri::command]
async fn db_saved_create(
    id: String,
    name: String,
    config: DbConfig,
) -> CommandResult<ClientSavedConnection> {
    saved_connections::save(id, name, config).map_err(CommandError::Query)
}

#[tauri::command]
async fn db_saved_delete(id: String) -> CommandResult<()> {
    saved_connections::delete(&id).map_err(CommandError::Query)
}

#[tauri::command]
async fn db_saved_connect(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<ConnectResponse> {
    let saved: SavedConnection = saved_connections::get(&id)
        .map_err(CommandError::Query)?
        .ok_or_else(|| CommandError::Query(format!("No saved connection with id {id}")))?;

    let database = saved.config.database.clone();
    let conn = PgConnection::connect(saved.config)
        .await
        .map_err(|e| CommandError::Connection(e.to_string()))?;

    let session_id = uuid::Uuid::new_v4().to_string();
    state.sessions.insert(session_id.clone(), Arc::new(conn));

    // Bump lastUsed timestamp; failures here don't abort the connect.
    saved_connections::mark_used(&id);

    Ok(ConnectResponse {
        session_id,
        database,
    })
}

fn first_column_strings(rows: &[Vec<JsonValue>]) -> Vec<String> {
    rows.iter()
        .filter_map(|r| r.first().and_then(|v| v.as_str().map(String::from)))
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MutateResponse {
    success: bool,
    affected_rows: Option<i64>,
    rows: Vec<JsonValue>,
}

#[tauri::command]
async fn db_mutate(
    session_id: String,
    body: MutationRequest,
    state: State<'_, AppState>,
) -> CommandResult<MutateResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let sql = mutation::build(&body).map_err(CommandError::Query)?;

    match body.kind {
        mutation::MutationKind::INSERT => {
            // INSERT … RETURNING * — use query() so we get the new row back.
            let result = conn
                .query(&sql)
                .await
                .map_err(|e| CommandError::Query(e.to_string()))?;
            let rows = postgres::rows_as_objects(&result);
            Ok(MutateResponse {
                success: true,
                affected_rows: Some(rows.len() as i64),
                rows,
            })
        }
        mutation::MutationKind::UPDATE | mutation::MutationKind::DELETE => {
            let affected = conn
                .execute(&sql, &[])
                .await
                .map_err(|e| CommandError::Query(e.to_string()))?;
            Ok(MutateResponse {
                success: true,
                affected_rows: Some(affected as i64),
                rows: vec![],
            })
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MutateBatchResponse {
    success: bool,
    row_counts: Vec<i64>,
}

#[tauri::command]
async fn db_mutate_batch(
    session_id: String,
    changes: Vec<MutationRequest>,
    state: State<'_, AppState>,
) -> CommandResult<MutateBatchResponse> {
    if changes.is_empty() {
        return Err(CommandError::Query(
            "Batch requires a non-empty `changes` array".into(),
        ));
    }

    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let mut statements: Vec<String> = Vec::with_capacity(changes.len());
    for (i, change) in changes.iter().enumerate() {
        let sql = mutation::build(change)
            .map_err(|e| CommandError::Query(format!("Change at index {i}: {e}")))?;
        statements.push(sql);
    }

    let row_counts = conn
        .run_transaction(&statements)
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(MutateBatchResponse {
        success: true,
        row_counts: row_counts.into_iter().map(|n| n as i64).collect(),
    })
}

#[derive(Serialize)]
struct LookupResponse {
    rows: Vec<JsonValue>,
}

#[derive(Serialize)]
struct DdlResponse {
    success: bool,
}

#[tauri::command]
async fn db_ddl(
    session_id: String,
    sql: String,
    state: State<'_, AppState>,
) -> CommandResult<DdlResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    // Mirror /api/ddl/route.ts: only CREATE TABLE is permitted. Trim + upper
    // for a cheap keyword check; the spike's table-creation-wizard is the
    // only caller and always produces a CREATE TABLE.
    if !sql.trim().to_uppercase().starts_with("CREATE TABLE") {
        return Err(CommandError::Query(
            "Only CREATE TABLE statements are allowed".into(),
        ));
    }

    conn.execute(&sql, &[])
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;
    Ok(DdlResponse { success: true })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SchemaMapResponse {
    schema_map: std::collections::BTreeMap<String, Vec<String>>,
}

#[tauri::command]
async fn db_schema_map(
    session_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<SchemaMapResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    // One query for all base-table columns in the schema, ordered for
    // deterministic grouping. Avoids the N+1 pattern in schema-map/route.ts.
    let res = conn
        .query_with_params(
            "SELECT c.table_name, c.column_name
             FROM information_schema.columns c
             JOIN information_schema.tables t
               ON t.table_schema = c.table_schema
              AND t.table_name = c.table_name
             WHERE c.table_schema = $1
               AND t.table_type = 'BASE TABLE'
             ORDER BY c.table_name, c.ordinal_position",
            &[Some(schema)],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    let mut schema_map: std::collections::BTreeMap<String, Vec<String>> =
        std::collections::BTreeMap::new();
    for row in &res.rows {
        let table = row.first().and_then(|v| v.as_str()).unwrap_or_default();
        let col = row.get(1).and_then(|v| v.as_str()).unwrap_or_default();
        if table.is_empty() || col.is_empty() {
            continue;
        }
        schema_map
            .entry(table.to_string())
            .or_default()
            .push(col.to_string());
    }
    Ok(SchemaMapResponse { schema_map })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ViewsResponse {
    views: Vec<String>,
    materialized_views: Vec<String>,
}

#[tauri::command]
async fn db_views(
    session_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<ViewsResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let views_res = conn
        .query_with_params(
            "SELECT table_name FROM information_schema.views
             WHERE table_schema = $1
             ORDER BY table_name",
            &[Some(schema.clone())],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    let matviews_res = conn
        .query_with_params(
            "SELECT matviewname AS name FROM pg_matviews
             WHERE schemaname = $1
             ORDER BY matviewname",
            &[Some(schema)],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(ViewsResponse {
        views: first_column_strings(&views_res.rows),
        materialized_views: first_column_strings(&matviews_res.rows),
    })
}

#[derive(Serialize)]
struct FunctionsResponse {
    functions: Vec<JsonValue>,
}

#[tauri::command]
async fn db_functions(
    session_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<FunctionsResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let functions = conn
        .query_objects(
            "SELECT
                p.proname AS name,
                pg_get_function_arguments(p.oid) AS arguments,
                t.typname AS return_type,
                l.lanname AS language,
                CASE p.prokind
                  WHEN 'f' THEN 'function'
                  WHEN 'p' THEN 'procedure'
                  WHEN 'a' THEN 'aggregate'
                  WHEN 'w' THEN 'window'
                END AS kind
             FROM pg_proc p
             JOIN pg_namespace n ON p.pronamespace = n.oid
             JOIN pg_type t ON p.prorettype = t.oid
             JOIN pg_language l ON p.prolang = l.oid
             WHERE n.nspname = $1
               AND p.prokind IN ('f', 'p')
             ORDER BY p.proname",
            &[Some(schema)],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(FunctionsResponse { functions })
}

#[derive(Serialize)]
struct TableCountsResponse {
    counts: std::collections::BTreeMap<String, i64>,
}

#[tauri::command]
async fn db_table_counts(
    session_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<TableCountsResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let res = conn
        .query_with_params(
            "SELECT c.relname AS table_name, c.reltuples::bigint AS estimate
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relkind = 'r' AND n.nspname = $1",
            &[Some(schema)],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    let mut counts: std::collections::BTreeMap<String, i64> =
        std::collections::BTreeMap::new();
    for row in &res.rows {
        let name = row.first().and_then(|v| v.as_str()).unwrap_or_default();
        let estimate = row.get(1).and_then(|v| v.as_i64()).unwrap_or(-1);
        // pg_class.reltuples is -1 for tables that have never been ANALYZE'd.
        // Skip those — surfacing "-1" in the sidebar would mislead.
        if name.is_empty() || estimate < 0 {
            continue;
        }
        counts.insert(name.to_string(), estimate);
    }
    Ok(TableCountsResponse { counts })
}

#[derive(Serialize)]
struct TableStatsResponse {
    stats: Option<JsonValue>,
}

#[tauri::command]
async fn db_table_stats(
    session_id: String,
    table: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<TableStatsResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let rows = conn
        .query_objects(
            "SELECT
                pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
                pg_size_pretty(pg_relation_size(c.oid))       AS table_size,
                pg_size_pretty(pg_indexes_size(c.oid))        AS index_size,
                c.reltuples::bigint                            AS estimated_rows,
                s.seq_scan,
                s.idx_scan,
                s.n_live_tup                                   AS live_rows,
                s.n_dead_tup                                   AS dead_rows,
                s.last_vacuum,
                s.last_autovacuum,
                s.last_analyze,
                s.last_autoanalyze
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
             WHERE c.relname = $1 AND n.nspname = $2",
            &[Some(table), Some(schema)],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(TableStatsResponse {
        stats: rows.into_iter().next(),
    })
}

#[derive(Serialize)]
struct RelationshipsResponse {
    relationships: Vec<JsonValue>,
    indexes: Vec<JsonValue>,
}

#[tauri::command]
async fn db_relationships(
    session_id: String,
    table: String,
    schema: String,
    state: State<'_, AppState>,
) -> CommandResult<RelationshipsResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    // FKs originating from this table — same SQL the SaaS provider's
    // getTableRelationships uses (lib/providers/postgresql.ts).
    let relationships = conn
        .query_objects(
            "SELECT
                tc.constraint_name,
                kcu.column_name AS source_column,
                ccu.table_schema AS target_schema,
                ccu.table_name AS target_table,
                ccu.column_name AS target_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
             JOIN information_schema.constraint_column_usage ccu
               ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_name = $1
               AND tc.table_schema = $2
             ORDER BY tc.constraint_name",
            &[Some(table.clone()), Some(schema.clone())],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    // Indexes — SaaS uses array_agg, but our postgres_value_to_json doesn't
    // yet decode pg arrays. jsonb_agg gives us a jsonb that decodes
    // straight through to JsonValue::Array for the `columns` field.
    let indexes = conn
        .query_objects(
            "SELECT
                i.relname AS index_name,
                am.amname AS index_type,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                jsonb_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
             FROM pg_class t
             JOIN pg_index ix ON t.oid = ix.indrelid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_am am ON i.relam = am.oid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
             WHERE t.relname = $1 AND n.nspname = $2
             GROUP BY i.relname, am.amname, ix.indisunique, ix.indisprimary
             ORDER BY i.relname",
            &[Some(table), Some(schema)],
        )
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;

    Ok(RelationshipsResponse {
        relationships,
        indexes,
    })
}

#[tauri::command]
async fn db_lookup_row(
    session_id: String,
    schema: String,
    table: String,
    column: String,
    value: JsonValue,
    state: State<'_, AppState>,
) -> CommandResult<LookupResponse> {
    let conn = state
        .sessions
        .get(&session_id)
        .map(|entry| entry.clone())
        .ok_or_else(|| CommandError::NoSession(session_id.clone()))?;

    let q_schema = postgres::quote_identifier(&schema).map_err(CommandError::Query)?;
    let q_table = postgres::quote_identifier(&table).map_err(CommandError::Query)?;
    let q_column = postgres::quote_identifier(&column).map_err(CommandError::Query)?;

    let literal = match value {
        JsonValue::Null => "NULL".into(),
        ref other => postgres::pg_quote_literal(&postgres::json_to_text(other)),
    };

    let sql = format!(
        "SELECT * FROM {q_schema}.{q_table} WHERE {q_column} = {literal} LIMIT 2"
    );

    let rows = conn
        .query_objects(&sql, &[])
        .await
        .map_err(|e| CommandError::Query(e.to_string()))?;
    Ok(LookupResponse { rows })
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
        &[Some(table), Some(schema)],
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
            db_mutate,
            db_mutate_batch,
            db_lookup_row,
            db_ddl,
            db_schema_map,
            db_relationships,
            db_views,
            db_functions,
            db_table_counts,
            db_table_stats,
            db_saved_list,
            db_saved_create,
            db_saved_delete,
            db_saved_connect,
            db_run_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
