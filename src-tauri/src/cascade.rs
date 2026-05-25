// Rust port of lib/cascade.ts — preview the rows that would be touched if
// the user committed a set of DELETEs. BFS over the FK graph starting from
// the requested rows; per-table counts on the affected children classified
// as cascade / setNull / blocked depending on the FK's delete_rule.
//
// Bounded by time budget, max depth, and max-children-followed per table —
// the dashboard's Review-SQL modal shows the preview before the user
// confirms, so we want a fast best-effort answer rather than an exact one.
//
// Same SQL-building strategy as mutation.rs: identifiers are quoted via
// quote_identifier (regex-validated), values inlined via pg_quote_literal.
// Lets Postgres coerce text → column type the same way the Node pg driver
// does on the SaaS side.

use serde::{Deserialize, Serialize};
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::time::Instant;

use crate::postgres::{
    json_to_text, pg_quote_literal, quote_identifier, rows_as_objects, PgConnection, QueryResult,
};

const DEFAULT_TIME_BUDGET_MS: u64 = 3000;
const DEFAULT_MAX_DEPTH: u32 = 6;
const DEFAULT_MAX_PER_TABLE: u32 = 1000;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CascadeOptions {
    pub time_budget_ms: Option<u64>,
    pub max_depth: Option<u32>,
    pub max_per_table: Option<u32>,
}

#[derive(Deserialize, Debug)]
pub struct CascadeNodeRequest {
    pub schema: String,
    pub table: String,
    pub pks: Vec<JsonMap<String, JsonValue>>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CascadeBucketEntry {
    pub schema: String,
    pub table: String,
    pub fk_constraint: String,
    pub fk_columns: Vec<String>,
    pub parent_schema: String,
    pub parent_table: String,
    pub parent_columns: Vec<String>,
    pub delete_rule: String,
    pub count: i64,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rows: Option<Vec<JsonValue>>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CascadeResult {
    pub success: bool,
    pub cascade: Vec<CascadeBucketEntry>,
    pub set_null: Vec<CascadeBucketEntry>,
    pub blocked: Vec<CascadeBucketEntry>,
    pub truncated: bool,
    pub elapsed_ms: u64,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug)]
struct IncomingForeignKey {
    constraint_name: String,
    child_schema: String,
    child_table: String,
    child_column: String,
    parent_column: String,
    delete_rule: String,
}

struct Node {
    schema: String,
    table: String,
    pks: Vec<JsonMap<String, JsonValue>>,
    depth: u32,
}

pub async fn preview(
    conn: &Arc<PgConnection>,
    deletes: Vec<CascadeNodeRequest>,
    options: Option<CascadeOptions>,
) -> CascadeResult {
    let opts = options.unwrap_or(CascadeOptions {
        time_budget_ms: None,
        max_depth: None,
        max_per_table: None,
    });
    let time_budget_ms = opts.time_budget_ms.unwrap_or(DEFAULT_TIME_BUDGET_MS);
    let max_depth = opts.max_depth.unwrap_or(DEFAULT_MAX_DEPTH);
    let max_per_table = opts.max_per_table.unwrap_or(DEFAULT_MAX_PER_TABLE);

    let start = Instant::now();
    let mut fk_cache: HashMap<String, Vec<IncomingForeignKey>> = HashMap::new();
    let mut pk_cache: HashMap<String, Vec<String>> = HashMap::new();
    let mut visited: HashSet<String> = HashSet::new();

    let mut cascade: Vec<CascadeBucketEntry> = Vec::new();
    let mut set_null: Vec<CascadeBucketEntry> = Vec::new();
    let mut blocked: Vec<CascadeBucketEntry> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut truncated_any = false;

    let mut queue: VecDeque<Node> = deletes
        .into_iter()
        .filter(|d| !d.pks.is_empty())
        .map(|d| Node {
            schema: d.schema,
            table: d.table,
            pks: d.pks,
            depth: 0,
        })
        .collect();

    while let Some(node) = queue.pop_front() {
        if (start.elapsed().as_millis() as u64) > time_budget_ms {
            truncated_any = true;
            warnings.push("Cascade preview hit the time budget; results may be incomplete.".into());
            break;
        }
        if node.depth >= max_depth {
            truncated_any = true;
            warnings.push(format!(
                "Reached max depth ({max_depth}) at {}.{}; deeper cascades not explored.",
                node.schema, node.table
            ));
            continue;
        }

        // Dedup: only process PKs we haven't visited yet.
        let mut fresh: Vec<JsonMap<String, JsonValue>> = Vec::new();
        for pk in node.pks.into_iter() {
            let key = row_key(&node.schema, &node.table, &pk);
            if visited.contains(&key) {
                continue;
            }
            visited.insert(key);
            fresh.push(pk);
        }
        if fresh.is_empty() {
            continue;
        }

        let fks = match get_cached_fks(conn, &mut fk_cache, &node.schema, &node.table).await {
            Ok(f) => f,
            Err(e) => {
                warnings.push(format!(
                    "Failed to fetch FKs for {}.{}: {e}",
                    node.schema, node.table
                ));
                continue;
            }
        };
        if fks.is_empty() {
            continue;
        }

        // A multi-column FK shows up as one row per column; regroup by constraint
        // so each constraint becomes one bucket entry with N child/parent column pairs.
        let mut by_constraint: HashMap<String, Vec<IncomingForeignKey>> = HashMap::new();
        for fk in &fks {
            let key = format!("{}.{}.{}", fk.child_schema, fk.child_table, fk.constraint_name);
            by_constraint.entry(key).or_default().push(fk.clone());
        }

        for group in by_constraint.into_values() {
            let first = group[0].clone();
            let child_cols: Vec<String> = group.iter().map(|g| g.child_column.clone()).collect();
            let parent_cols: Vec<String> = group.iter().map(|g| g.parent_column.clone()).collect();

            // Build tuples of parent-PK values aligned to parent_cols.
            // Skip rows where any parent column is missing or NULL — those
            // can never match a child FK anyway.
            let mut tuples: Vec<Vec<JsonValue>> = Vec::new();
            for pk in &fresh {
                let mut tuple = Vec::with_capacity(parent_cols.len());
                let mut skip = false;
                for c in &parent_cols {
                    match pk.get(c) {
                        None | Some(JsonValue::Null) => {
                            skip = true;
                            break;
                        }
                        Some(v) => tuple.push(v.clone()),
                    }
                }
                if !skip {
                    tuples.push(tuple);
                }
            }
            if tuples.is_empty() {
                continue;
            }

            let count_sql = match build_count_sql(
                &first.child_schema,
                &first.child_table,
                &child_cols,
                &tuples,
            ) {
                Ok(s) => s,
                Err(e) => {
                    warnings.push(format!("Build count query failed: {e}"));
                    continue;
                }
            };

            let count = match conn.query(&count_sql).await {
                Ok(r) => extract_count(&r),
                Err(e) => {
                    warnings.push(format!(
                        "Count query failed for {}.{}: {e}",
                        first.child_schema, first.child_table
                    ));
                    continue;
                }
            };
            if count == 0 {
                continue;
            }

            let mut entry = CascadeBucketEntry {
                schema: first.child_schema.clone(),
                table: first.child_table.clone(),
                fk_constraint: first.constraint_name.clone(),
                fk_columns: child_cols.clone(),
                parent_schema: node.schema.clone(),
                parent_table: node.table.clone(),
                parent_columns: parent_cols.clone(),
                delete_rule: first.delete_rule.clone(),
                count,
                truncated: false,
                sample_rows: None,
            };

            if first.delete_rule == "RESTRICT" || first.delete_rule == "NO ACTION" {
                blocked.push(entry);
                continue;
            }
            if first.delete_rule == "SET NULL" || first.delete_rule == "SET DEFAULT" {
                set_null.push(entry);
                continue;
            }

            // CASCADE — follow into the child table's children. Need child's
            // PK columns to enqueue the next BFS level.
            let child_pk_cols =
                match get_cached_pks(conn, &mut pk_cache, &first.child_schema, &first.child_table)
                    .await
                {
                    Ok(p) => p,
                    Err(e) => {
                        warnings.push(format!(
                            "Failed to fetch PKs for {}.{}: {e}",
                            first.child_schema, first.child_table
                        ));
                        cascade.push(entry);
                        continue;
                    }
                };
            if child_pk_cols.is_empty() {
                warnings.push(format!(
                    "Cannot follow cascade into {}.{}: no primary key detected.",
                    first.child_schema, first.child_table
                ));
                cascade.push(entry);
                continue;
            }

            let pk_sql = match build_select_pks_sql(
                &first.child_schema,
                &first.child_table,
                &child_cols,
                &child_pk_cols,
                &tuples,
                max_per_table,
            ) {
                Ok(s) => s,
                Err(e) => {
                    warnings.push(format!("Build PK select failed: {e}"));
                    cascade.push(entry);
                    continue;
                }
            };

            let child_rows = match conn.query(&pk_sql).await {
                Ok(r) => rows_as_objects(&r),
                Err(e) => {
                    warnings.push(format!(
                        "Child PK fetch failed for {}.{}: {e}",
                        first.child_schema, first.child_table
                    ));
                    cascade.push(entry);
                    continue;
                }
            };

            if count > child_rows.len() as i64 {
                entry.truncated = true;
                truncated_any = true;
            }
            let child_schema = first.child_schema.clone();
            let child_table = first.child_table.clone();
            cascade.push(entry);

            // Project rows down to just the PK columns; that's what the next
            // BFS layer needs for its WHERE clause.
            let child_pks: Vec<JsonMap<String, JsonValue>> = child_rows
                .into_iter()
                .filter_map(|row| {
                    if let JsonValue::Object(mut map) = row {
                        let mut projected = JsonMap::new();
                        for c in &child_pk_cols {
                            if let Some(v) = map.remove(c) {
                                projected.insert(c.clone(), v);
                            }
                        }
                        Some(projected)
                    } else {
                        None
                    }
                })
                .collect();

            if !child_pks.is_empty() {
                queue.push_back(Node {
                    schema: child_schema,
                    table: child_table,
                    pks: child_pks,
                    depth: node.depth + 1,
                });
            }
        }
    }

    CascadeResult {
        success: true,
        cascade,
        set_null,
        blocked,
        truncated: truncated_any,
        elapsed_ms: start.elapsed().as_millis() as u64,
        warnings,
    }
}

fn row_key(schema: &str, table: &str, pks: &JsonMap<String, JsonValue>) -> String {
    let mut keys: Vec<&String> = pks.keys().collect();
    keys.sort();
    let pairs: Vec<(&String, &JsonValue)> = keys.iter().map(|k| (*k, &pks[*k])).collect();
    let json = serde_json::to_string(&pairs).unwrap_or_default();
    format!("{schema}.{table}:{json}")
}

async fn get_cached_fks(
    conn: &Arc<PgConnection>,
    cache: &mut HashMap<String, Vec<IncomingForeignKey>>,
    schema: &str,
    table: &str,
) -> Result<Vec<IncomingForeignKey>, String> {
    let key = format!("{schema}.{table}");
    if let Some(cached) = cache.get(&key) {
        return Ok(cached.clone());
    }
    let fks = fetch_incoming_fks(conn, schema, table).await?;
    cache.insert(key, fks.clone());
    Ok(fks)
}

async fn fetch_incoming_fks(
    conn: &Arc<PgConnection>,
    schema: &str,
    table: &str,
) -> Result<Vec<IncomingForeignKey>, String> {
    let res = conn
        .query_with_params(
            "SELECT
                rc.constraint_name,
                tc.table_schema       AS child_schema,
                tc.table_name         AS child_table,
                kcu_child.column_name AS child_column,
                kcu_parent.column_name AS parent_column,
                rc.delete_rule
             FROM information_schema.referential_constraints rc
             JOIN information_schema.table_constraints tc
               ON tc.constraint_name = rc.constraint_name
              AND tc.constraint_schema = rc.constraint_schema
              AND tc.constraint_type = 'FOREIGN KEY'
             JOIN information_schema.key_column_usage kcu_child
               ON kcu_child.constraint_name = rc.constraint_name
              AND kcu_child.constraint_schema = rc.constraint_schema
             JOIN information_schema.key_column_usage kcu_parent
               ON kcu_parent.constraint_name = rc.unique_constraint_name
              AND kcu_parent.constraint_schema = rc.unique_constraint_schema
              AND kcu_parent.ordinal_position = kcu_child.position_in_unique_constraint
             WHERE kcu_parent.table_name = $1
               AND kcu_parent.table_schema = $2
             ORDER BY rc.constraint_name, kcu_child.ordinal_position",
            &[Some(table.to_string()), Some(schema.to_string())],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(res.rows.len());
    for row in &res.rows {
        out.push(IncomingForeignKey {
            constraint_name: cell_str(row, 0),
            child_schema: cell_str(row, 1),
            child_table: cell_str(row, 2),
            child_column: cell_str(row, 3),
            parent_column: cell_str(row, 4),
            delete_rule: normalize_delete_rule(&cell_str(row, 5)),
        });
    }
    Ok(out)
}

async fn get_cached_pks(
    conn: &Arc<PgConnection>,
    cache: &mut HashMap<String, Vec<String>>,
    schema: &str,
    table: &str,
) -> Result<Vec<String>, String> {
    let key = format!("{schema}.{table}");
    if let Some(cached) = cache.get(&key) {
        return Ok(cached.clone());
    }
    let pks = fetch_table_pks(conn, schema, table).await?;
    cache.insert(key, pks.clone());
    Ok(pks)
}

async fn fetch_table_pks(
    conn: &Arc<PgConnection>,
    schema: &str,
    table: &str,
) -> Result<Vec<String>, String> {
    let res = conn
        .query_with_params(
            "SELECT c.column_name
             FROM information_schema.columns c
             INNER JOIN (
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
            &[Some(table.to_string()), Some(schema.to_string())],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(res
        .rows
        .iter()
        .filter_map(|r| r.first().and_then(|v| v.as_str().map(String::from)))
        .collect())
}

fn normalize_delete_rule(raw: &str) -> String {
    match raw.trim().to_uppercase().as_str() {
        "CASCADE" => "CASCADE".into(),
        "RESTRICT" => "RESTRICT".into(),
        "SET NULL" => "SET NULL".into(),
        "SET DEFAULT" => "SET DEFAULT".into(),
        _ => "NO ACTION".into(),
    }
}

fn extract_count(result: &QueryResult) -> i64 {
    result
        .rows
        .first()
        .and_then(|r| r.first())
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(0)
}

fn cell_str(row: &[JsonValue], idx: usize) -> String {
    row.get(idx)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn build_count_sql(
    schema: &str,
    table: &str,
    child_cols: &[String],
    tuples: &[Vec<JsonValue>],
) -> Result<String, String> {
    let qt = qualified(schema, table)?;
    let where_clause = build_where_clause(child_cols, tuples)?;
    Ok(format!(
        "SELECT COUNT(*) AS count FROM {qt} WHERE {where_clause}"
    ))
}

fn build_select_pks_sql(
    schema: &str,
    table: &str,
    child_cols: &[String],
    pk_cols: &[String],
    tuples: &[Vec<JsonValue>],
    limit: u32,
) -> Result<String, String> {
    let qt = qualified(schema, table)?;
    let where_clause = build_where_clause(child_cols, tuples)?;
    let mut q_cols = Vec::with_capacity(pk_cols.len());
    for c in pk_cols {
        q_cols.push(quote_identifier(c)?);
    }
    let safe_limit = std::cmp::max(1, limit);
    Ok(format!(
        "SELECT {} FROM {qt} WHERE {where_clause} LIMIT {safe_limit}",
        q_cols.join(", ")
    ))
}

fn qualified(schema: &str, table: &str) -> Result<String, String> {
    Ok(format!(
        "{}.{}",
        quote_identifier(schema)?,
        quote_identifier(table)?
    ))
}

fn build_where_clause(
    child_cols: &[String],
    tuples: &[Vec<JsonValue>],
) -> Result<String, String> {
    let mut q_cols = Vec::with_capacity(child_cols.len());
    for c in child_cols {
        q_cols.push(quote_identifier(c)?);
    }

    if child_cols.len() == 1 {
        let col = &q_cols[0];
        let lits: Vec<String> = tuples
            .iter()
            .map(|t| t.first().map(value_literal).unwrap_or_else(|| "NULL".into()))
            .collect();
        return Ok(format!("{col} IN ({})", lits.join(", ")));
    }

    let cols_list = q_cols.join(", ");
    let tuple_strs: Vec<String> = tuples
        .iter()
        .map(|t| {
            let lits: Vec<String> = t.iter().map(value_literal).collect();
            format!("({})", lits.join(", "))
        })
        .collect();
    Ok(format!("({cols_list}) IN ({})", tuple_strs.join(", ")))
}

fn value_literal(v: &JsonValue) -> String {
    match v {
        JsonValue::Null => "NULL".into(),
        other => pg_quote_literal(&json_to_text(other)),
    }
}
