// Rust port of lib/mutation.ts — builds INSERT/UPDATE/DELETE statements
// for the desktop app's mutate endpoints. Postgres-only for now;
// MySQL/SQLite dialects join when their providers do.
//
// Values are inlined as escaped SQL literals (via pg_quote_literal) rather
// than bound as parameters. tokio-postgres uses binary parameter encoding
// with strict type matching, which fails when binding a String to e.g. a
// uuid column. Inlining text literals lets Postgres do its own text →
// column-type coercion, exactly like the SaaS pg/Node driver does by
// default.

use serde::Deserialize;
use serde_json::Value as JsonValue;
use std::collections::BTreeMap;

use crate::postgres::{json_to_text, pg_quote_literal, quote_identifier};

#[derive(Deserialize, Debug, PartialEq, Eq, Clone, Copy)]
#[allow(clippy::upper_case_acronyms)]
pub enum MutationKind {
    INSERT,
    UPDATE,
    DELETE,
}

#[derive(Deserialize, Debug)]
pub struct MutationRequest {
    #[serde(rename = "type")]
    pub kind: MutationKind,
    pub schema: String,
    pub table: String,
    pub values: Option<BTreeMap<String, JsonValue>>,
    #[serde(rename = "where")]
    pub where_clause: Option<BTreeMap<String, JsonValue>>,
}

pub fn build(req: &MutationRequest) -> Result<String, String> {
    match req.kind {
        MutationKind::UPDATE => {
            let values = req.values.as_ref().ok_or("UPDATE requires values")?;
            let where_clause = req
                .where_clause
                .as_ref()
                .ok_or("UPDATE requires where")?;
            build_update(&req.schema, &req.table, values, where_clause)
        }
        MutationKind::INSERT => {
            let values = req.values.as_ref().ok_or("INSERT requires values")?;
            build_insert(&req.schema, &req.table, values)
        }
        MutationKind::DELETE => {
            let where_clause = req
                .where_clause
                .as_ref()
                .ok_or("DELETE requires where")?;
            build_delete(&req.schema, &req.table, where_clause)
        }
    }
}

fn qualified_table(schema: &str, table: &str) -> Result<String, String> {
    Ok(format!(
        "{}.{}",
        quote_identifier(schema)?,
        quote_identifier(table)?,
    ))
}

fn build_update(
    schema: &str,
    table: &str,
    values: &BTreeMap<String, JsonValue>,
    where_clause: &BTreeMap<String, JsonValue>,
) -> Result<String, String> {
    let qualified = qualified_table(schema, table)?;
    let mut set_clauses = Vec::with_capacity(values.len());
    let mut where_clauses = Vec::with_capacity(where_clause.len());

    for (col, val) in values {
        let q_col = quote_identifier(col)?;
        set_clauses.push(format!("{q_col} = {}", literal_for_set(val)));
    }
    for (col, val) in where_clause {
        let q_col = quote_identifier(col)?;
        where_clauses.push(format!("{q_col} = {}", literal_for_where(val)));
    }

    if set_clauses.is_empty() {
        return Err("UPDATE requires at least one value to set".into());
    }
    if where_clauses.is_empty() {
        return Err("UPDATE requires at least one primary key condition".into());
    }

    Ok(format!(
        "UPDATE {qualified} SET {} WHERE {}",
        set_clauses.join(", "),
        where_clauses.join(" AND "),
    ))
}

fn build_insert(
    schema: &str,
    table: &str,
    values: &BTreeMap<String, JsonValue>,
) -> Result<String, String> {
    let qualified = qualified_table(schema, table)?;
    let mut columns = Vec::with_capacity(values.len());
    let mut literals = Vec::with_capacity(values.len());

    for (col, val) in values {
        // lib/mutation.ts skips empty/undefined columns entirely in INSERT.
        if is_empty_or_skip(val) {
            continue;
        }
        columns.push(quote_identifier(col)?);
        literals.push(literal_for_insert(val));
    }

    if columns.is_empty() {
        return Err("INSERT requires at least one value".into());
    }

    Ok(format!(
        "INSERT INTO {qualified} ({}) VALUES ({}) RETURNING *",
        columns.join(", "),
        literals.join(", "),
    ))
}

fn build_delete(
    schema: &str,
    table: &str,
    where_clause: &BTreeMap<String, JsonValue>,
) -> Result<String, String> {
    let qualified = qualified_table(schema, table)?;
    let mut where_clauses = Vec::with_capacity(where_clause.len());

    for (col, val) in where_clause {
        let q_col = quote_identifier(col)?;
        where_clauses.push(format!("{q_col} = {}", literal_for_where(val)));
    }

    if where_clauses.is_empty() {
        return Err("DELETE requires at least one primary key condition".into());
    }

    Ok(format!(
        "DELETE FROM {qualified} WHERE {}",
        where_clauses.join(" AND "),
    ))
}

// ─── JsonValue → SQL literal ─────────────────────────────────────

fn is_empty_or_skip(val: &JsonValue) -> bool {
    matches!(val, JsonValue::String(s) if s.is_empty())
}

// SET (UPDATE values): empty string coerces to NULL.
fn literal_for_set(val: &JsonValue) -> String {
    match val {
        JsonValue::Null => "NULL".into(),
        JsonValue::String(s) if s.is_empty() => "NULL".into(),
        other => pg_quote_literal(&json_to_text(other)),
    }
}

// INSERT values: callers already filtered empty/undefined; honor the
// special "NULL" string sentinel from lib/mutation.ts.
fn literal_for_insert(val: &JsonValue) -> String {
    match val {
        JsonValue::Null => "NULL".into(),
        JsonValue::String(s) if s == "NULL" => "NULL".into(),
        other => pg_quote_literal(&json_to_text(other)),
    }
}

// WHERE (primary keys): no coercion — empty string is intentional.
fn literal_for_where(val: &JsonValue) -> String {
    match val {
        JsonValue::Null => "NULL".into(),
        other => pg_quote_literal(&json_to_text(other)),
    }
}
