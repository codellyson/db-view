//! Opt-in, provider-agnostic AI integration: natural-language → SQL.
//!
//! Supports Anthropic (Claude), OpenAI (GPT), and Google (Gemini). The user's
//! provider API key lives in the OS keychain — the same store
//! `saved_connections` uses — and never reaches the webview. Each provider is
//! called over plain HTTPS (no provider SDK), so nothing here is tied to one
//! vendor; `ai_generate_sql` dispatches on the stored `provider`.
//!
//! All three providers are asked for structured JSON output ({sql,
//! explanation}) so we get back data instead of prose to scrape.

use async_trait::async_trait;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

const SERVICE: &str = "com.kreativekorna.justdb";
const ACCOUNT: &str = "ai-provider";

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const OPENAI_URL: &str = "https://api.openai.com/v1/chat/completions";
const GOOGLE_URL_TMPL: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

const MAX_TOKENS: u32 = 2048;

// Agent loop bounds (AI mode).
const MAX_AGENT_STEPS: usize = 8;
const MAX_ROWS_TO_MODEL: usize = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Provider {
    Anthropic,
    OpenAi,
    Google,
}

impl Provider {
    fn parse(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "anthropic" | "claude" => Ok(Provider::Anthropic),
            "openai" | "gpt" => Ok(Provider::OpenAi),
            "google" | "gemini" => Ok(Provider::Google),
            other => Err(format!("Unknown AI provider: {other}")),
        }
    }

    fn default_model(self) -> &'static str {
        match self {
            Provider::Anthropic => "claude-opus-4-8",
            Provider::OpenAi => "gpt-4o",
            Provider::Google => "gemini-2.5-flash",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AiConfig {
    provider: String,
    #[serde(rename = "apiKey")]
    api_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    model: Option<String>,
}

impl AiConfig {
    fn resolved_model(&self) -> Result<String, String> {
        Ok(match &self.model {
            Some(m) if !m.trim().is_empty() => m.trim().to_string(),
            _ => Provider::parse(&self.provider)?.default_model().to_string(),
        })
    }
}

/// Sent to the frontend — never carries the key itself.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    pub configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateArgs {
    /// The natural-language request.
    pub prompt: String,
    /// "postgresql" | "sqlite" | "mysql" — used to steer dialect-specific SQL.
    pub dialect: String,
    /// Pre-formatted schema text assembled by the frontend (table(col, col)…).
    pub schema: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResult {
    pub sql: String,
    pub explanation: String,
}

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("keychain: {e}"))
}

fn load() -> Result<Option<AiConfig>, String> {
    let e = entry()?;
    match e.get_password() {
        Ok(json) => serde_json::from_str(&json)
            .map(Some)
            .map_err(|err| format!("parse: {err}")),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("keychain read: {err}")),
    }
}

pub fn status() -> Result<AiStatus, String> {
    Ok(match load()? {
        Some(c) => AiStatus {
            configured: true,
            model: Some(c.resolved_model()?),
            provider: Some(c.provider),
        },
        None => AiStatus {
            configured: false,
            provider: None,
            model: None,
        },
    })
}

pub fn set_key(provider: String, api_key: String, model: Option<String>) -> Result<AiStatus, String> {
    // Validate the provider name up front so a typo fails at save time rather
    // than on the first generate.
    Provider::parse(&provider)?;
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }
    let cfg = AiConfig {
        provider: provider.trim().to_lowercase(),
        api_key: api_key.trim().to_string(),
        model: model.filter(|m| !m.trim().is_empty()),
    };
    let json = serde_json::to_string(&cfg).map_err(|e| format!("serialize: {e}"))?;
    entry()?
        .set_password(&json)
        .map_err(|e| format!("keychain write: {e}"))?;
    status()
}

pub fn clear_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("keychain delete: {err}")),
    }
}

fn system_prompt(dialect: &str, schema: &str) -> String {
    format!(
        "You are an expert {dialect} SQL author. Given a database schema and a \
         natural-language request, produce ONE valid {dialect} SQL statement that \
         fulfills it. Use only the tables and columns present in the schema, and \
         write every identifier EXACTLY as it appears there, including any double \
         quotes — in PostgreSQL an unquoted MixedCase name folds to lowercase and \
         won't match (e.g. use \"Educator\", not Educator). Prefer an explicit \
         column list over SELECT *. Do not wrap the SQL in markdown fences. If the \
         request cannot be satisfied with the given schema, return an empty `sql` \
         and explain why in `explanation`.\n\nSchema:\n{schema}",
    )
}

/// Shared JSON-Schema for the {sql, explanation} object. `strict_subset`
/// drops `additionalProperties` for providers (Gemini) that reject it.
fn output_schema(strict_subset: bool) -> Value {
    let mut s = json!({
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": "The SQL statement, or empty string if it cannot be produced."
            },
            "explanation": {
                "type": "string",
                "description": "One or two sentences explaining the query, or why it could not be produced."
            }
        },
        "required": ["sql", "explanation"]
    });
    if !strict_subset {
        s["additionalProperties"] = json!(false);
    }
    s
}

/// Best-effort pull of a provider's error message from a non-2xx body.
/// All three wrap it as `error.message`.
fn error_message(body: &str) -> String {
    serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| {
            v.get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| body.to_string())
}

pub async fn generate_sql(args: GenerateArgs) -> Result<GenerateResult, String> {
    let cfg = load()?.ok_or("AI is not configured. Add an API key first.")?;
    let provider = Provider::parse(&cfg.provider)?;
    let model = cfg.resolved_model()?;
    let system = system_prompt(&args.dialect, &args.schema);

    let text = match provider {
        Provider::Anthropic => call_anthropic(&cfg.api_key, &model, &system, &args.prompt).await?,
        Provider::OpenAi => call_openai(&cfg.api_key, &model, &system, &args.prompt).await?,
        Provider::Google => call_google(&cfg.api_key, &model, &system, &args.prompt).await?,
    };

    serde_json::from_str::<GenerateResult>(text.trim())
        .map_err(|e| format!("could not parse generated SQL: {e}"))
}

async fn call_anthropic(
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": system,
        "messages": [{ "role": "user", "content": user }],
        "output_config": {
            "format": { "type": "json_schema", "schema": output_schema(false) }
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(ANTHROPIC_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI request failed: {e}"))?;

    let http_status = resp.status();
    let text = resp.text().await.map_err(|e| format!("could not read AI response: {e}"))?;
    if !http_status.is_success() {
        return Err(format!("AI request failed ({http_status}): {}", error_message(&text)));
    }

    let v: Value = serde_json::from_str(&text).map_err(|e| format!("could not parse AI response: {e}"))?;
    if v.get("stop_reason").and_then(|s| s.as_str()) == Some("refusal") {
        return Err("The model declined this request.".to_string());
    }
    v.get("content")
        .and_then(|c| c.as_array())
        .and_then(|arr| {
            arr.iter().find_map(|b| {
                if b.get("type").and_then(|t| t.as_str()) == Some("text") {
                    b.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| "AI returned no text content".to_string())
}

async fn call_openai(
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user }
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "sql_result",
                "strict": true,
                "schema": output_schema(false)
            }
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(OPENAI_URL)
        .header("authorization", format!("Bearer {api_key}"))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI request failed: {e}"))?;

    let http_status = resp.status();
    let text = resp.text().await.map_err(|e| format!("could not read AI response: {e}"))?;
    if !http_status.is_success() {
        return Err(format!("AI request failed ({http_status}): {}", error_message(&text)));
    }

    let v: Value = serde_json::from_str(&text).map_err(|e| format!("could not parse AI response: {e}"))?;
    let choice = v.get("choices").and_then(|c| c.as_array()).and_then(|a| a.first());
    if let Some(reason) = choice.and_then(|c| c.get("finish_reason")).and_then(|r| r.as_str()) {
        if reason == "content_filter" {
            return Err("The model declined this request.".to_string());
        }
    }
    choice
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "AI returned no text content".to_string())
}

async fn call_google(
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, String> {
    let url = GOOGLE_URL_TMPL.replace("{model}", model);
    let body = json!({
        "system_instruction": { "parts": [{ "text": system }] },
        "contents": [{ "role": "user", "parts": [{ "text": user }] }],
        "generationConfig": {
            "maxOutputTokens": MAX_TOKENS,
            "responseMimeType": "application/json",
            // Gemini rejects `additionalProperties`, so use the trimmed schema.
            "responseSchema": output_schema(true)
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI request failed: {e}"))?;

    let http_status = resp.status();
    let text = resp.text().await.map_err(|e| format!("could not read AI response: {e}"))?;
    if !http_status.is_success() {
        return Err(format!("AI request failed ({http_status}): {}", error_message(&text)));
    }

    let v: Value = serde_json::from_str(&text).map_err(|e| format!("could not parse AI response: {e}"))?;
    // A prompt blocked outright has no candidates, just promptFeedback.
    if let Some(reason) = v
        .get("promptFeedback")
        .and_then(|f| f.get("blockReason"))
        .and_then(|r| r.as_str())
    {
        return Err(format!("The model declined this request ({reason})."));
    }
    let candidate = v.get("candidates").and_then(|c| c.as_array()).and_then(|a| a.first());
    if let Some(reason) = candidate.and_then(|c| c.get("finishReason")).and_then(|r| r.as_str()) {
        if reason == "SAFETY" || reason == "BLOCKLIST" || reason == "PROHIBITED_CONTENT" {
            return Err("The model declined this request.".to_string());
        }
    }
    candidate
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.as_array())
        .and_then(|arr| arr.iter().find_map(|p| p.get("text").and_then(|t| t.as_str())))
        .map(|s| s.to_string())
        .ok_or_else(|| "AI returned no text content".to_string())
}

// ─── AI mode (agentic, tool-using chat) ───────────────────────────────────

/// The agent's gateway to the live connection. Implemented in lib.rs over the
/// session's `DbConnection` so this module stays DB-backend-agnostic.
#[async_trait]
pub trait SqlRunner: Send + Sync {
    /// Run a read-only query and return the rows as JSON objects.
    async fn run_readonly(&self, sql: &str) -> Result<Vec<Value>, String>;
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String, // "user" | "assistant"
    pub content: String,
}

/// One tool action the agent took during a turn — surfaced to the UI so the
/// user can see exactly which SQL ran.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStep {
    pub kind: String, // "run_sql" | "propose_write"
    pub sql: String,
    pub ok: bool,
    pub summary: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub reply: String,
    pub steps: Vec<ChatStep>,
    /// Data/DDL changes the agent proposed — never executed here; the UI gates
    /// them through the normal confirmation flow.
    pub proposed_writes: Vec<String>,
}

/// Conservative read-only gate for the agent's `run_sql` tool. Rejects
/// anything that isn't a single SELECT/WITH/EXPLAIN/SHOW and any statement
/// carrying a write keyword (covers writable CTEs and `EXPLAIN ANALYZE INSERT`).
fn is_read_only(sql: &str) -> bool {
    let cleaned = sql
        .lines()
        .map(|l| match l.find("--") {
            Some(i) => &l[..i],
            None => l,
        })
        .collect::<Vec<_>>()
        .join("\n");
    let trimmed = cleaned.trim().trim_end_matches(';');
    if trimmed.is_empty() || trimmed.contains(';') {
        return false; // empty, or multiple statements
    }
    let lower = trimmed.to_lowercase();
    let first = lower.split_whitespace().next().unwrap_or("");
    if !matches!(first, "select" | "with" | "explain" | "show") {
        return false;
    }
    let padded = format!(" {} ", lower.replace(['\n', '\t', '(', ')', ','], " "));
    const WRITE_KW: [&str; 11] = [
        " insert ", " update ", " delete ", " drop ", " alter ", " create ",
        " truncate ", " grant ", " revoke ", " merge ", " replace ",
    ];
    !WRITE_KW.iter().any(|kw| padded.contains(kw))
}

#[cfg(test)]
mod tests {
    use super::is_read_only;

    #[test]
    fn allows_read_only_statements() {
        assert!(is_read_only("SELECT * FROM users"));
        assert!(is_read_only("select id from t where x = 1"));
        assert!(is_read_only("WITH c AS (SELECT 1) SELECT * FROM c"));
        assert!(is_read_only("EXPLAIN SELECT * FROM t"));
        assert!(is_read_only("SHOW TABLES"));
        assert!(is_read_only("SELECT 1; ")); // single statement, trailing ;
        assert!(is_read_only("-- a comment\nSELECT * FROM t"));
    }

    #[test]
    fn blocks_writes_and_ddl() {
        for sql in [
            "INSERT INTO t VALUES (1)",
            "UPDATE t SET x = 1",
            "DELETE FROM t",
            "DROP TABLE t",
            "ALTER TABLE t ADD COLUMN x int",
            "CREATE TABLE t (id int)",
            "TRUNCATE t",
        ] {
            assert!(!is_read_only(sql), "should block: {sql}");
        }
    }

    #[test]
    fn blocks_multiple_statements() {
        assert!(!is_read_only("SELECT 1; DELETE FROM t"));
    }

    #[test]
    fn blocks_writable_cte_and_explained_write() {
        assert!(!is_read_only("WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d"));
        assert!(!is_read_only("EXPLAIN ANALYZE INSERT INTO t VALUES (1)"));
    }

    #[test]
    fn blocks_empty() {
        assert!(!is_read_only(""));
        assert!(!is_read_only("   "));
    }
}

fn chat_system_prompt(dialect: &str, schema: &str) -> String {
    format!(
        "You are a {dialect} database assistant embedded in a SQL GUI. Answer the \
         user's questions about their database by exploring it with the `run_sql` \
         tool (read-only: SELECT / WITH / EXPLAIN only). Prefer running real queries \
         over guessing, and add a LIMIT when scanning potentially large tables. Write \
         every identifier EXACTLY as it appears in the schema, including any double \
         quotes — in PostgreSQL an unquoted MixedCase name folds to lowercase and \
         won't match (e.g. use \"Educator\", not Educator). If a query fails with \
         'relation/column does not exist', do NOT re-run the same query — call \
         `list_tables` to find the exact table name or `describe_table` to get exact \
         column names, then write a corrected query. To change data or schema, do NOT use \
         run_sql — call `propose_write` with the exact SQL and a short reason; the user \
         reviews and runs it themselves. When you have the answer, reply concisely in \
         plain language with the relevant numbers or a small table; never paste large \
         result sets.\n\nSchema:\n{schema}",
    )
}

pub async fn chat(
    runner: &dyn SqlRunner,
    messages: Vec<ChatMessage>,
    dialect: String,
    schema: String,
    model_override: Option<String>,
    on_step: StepSink<'_>,
    on_token: TokenSink<'_>,
) -> Result<ChatResponse, String> {
    let cfg = load()?.ok_or("AI is not configured. Add an API key first.")?;
    let provider = Provider::parse(&cfg.provider)?;
    // AI mode may request a different (e.g. stronger) model than the stored
    // default used by the single-shot Generate bar.
    let model = match model_override {
        Some(m) if !m.trim().is_empty() => m.trim().to_string(),
        _ => cfg.resolved_model()?,
    };
    match provider {
        Provider::Google => {
            chat_google(&cfg.api_key, &model, runner, messages, &dialect, &schema, on_step, on_token).await
        }
        Provider::Anthropic => {
            chat_anthropic(&cfg.api_key, &model, runner, messages, &dialect, &schema, on_step, on_token).await
        }
        Provider::OpenAi => {
            chat_openai(&cfg.api_key, &model, runner, messages, &dialect, &schema, on_step, on_token).await
        }
    }
}

const RUN_SQL_DESC: &str = "Run a READ-ONLY SQL query (SELECT/WITH/EXPLAIN only) against the connected database and get the rows back. Use this to explore the data and answer the question. Never use it to modify data or schema.";
const PROPOSE_DESC: &str = "Propose a data-modifying or DDL statement (INSERT/UPDATE/DELETE/CREATE/ALTER/DROP) for the user to review and run. This does NOT execute. Use it whenever the task requires changing data or schema.";
const LIST_TABLES_DESC: &str = "List the real, schema-qualified table names in the database. Call this to discover exact names when a query fails with 'does not exist' or when you are unsure a table exists.";
const DESCRIBE_TABLE_DESC: &str = "Show a table's columns and types. Call this to get the exact, correctly-cased column names before querying.";

fn run_sql_params() -> Value {
    json!({
        "type": "object",
        "properties": { "sql": { "type": "string", "description": "A single read-only SQL statement." } },
        "required": ["sql"]
    })
}

fn propose_params() -> Value {
    json!({
        "type": "object",
        "properties": {
            "sql": { "type": "string", "description": "The exact statement to run." },
            "reason": { "type": "string", "description": "Why this change is needed." }
        },
        "required": ["sql"]
    })
}

fn no_params() -> Value {
    json!({ "type": "object", "properties": {} })
}

fn describe_params() -> Value {
    json!({
        "type": "object",
        "properties": { "table": { "type": "string", "description": "Table name to describe, as shown by list_tables." } },
        "required": ["table"]
    })
}

fn list_tables_sql(dialect: &str) -> String {
    if dialect.eq_ignore_ascii_case("sqlite") {
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name".to_string()
    } else {
        "SELECT table_schema || '.' || table_name AS \"table\" \
         FROM information_schema.tables \
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema') \
           AND table_type = 'BASE TABLE' \
         ORDER BY table_schema, table_name".to_string()
    }
}

fn describe_table_sql(dialect: &str, table: &str) -> String {
    // The model may pass `schema.table`, `"Table"`, or bare — reduce to the
    // bare, unquoted name for matching/PRAGMA.
    let bare = table.rsplit('.').next().unwrap_or(table).trim().trim_matches('"');
    if dialect.eq_ignore_ascii_case("sqlite") {
        format!("PRAGMA table_info(\"{}\")", bare.replace('"', "\"\""))
    } else {
        format!(
            "SELECT column_name, data_type, is_nullable FROM information_schema.columns \
             WHERE table_name = '{}' ORDER BY ordinal_position",
            bare.replace('\'', "''")
        )
    }
}

/// Execute one tool call. Shared by all providers — only the request/response
/// framing around it differs per vendor. Returns the JSON payload to feed back
/// to the model, and records a [`ChatStep`] / proposed write as a side effect.
/// Sink for live progress events — implemented in lib.rs to emit a Tauri event
/// to the webview as each step completes.
pub type StepSink<'a> = &'a (dyn Fn(&ChatStep) + Send + Sync);

/// Sink for streamed answer text — emits a Tauri event per token chunk so the
/// reply types out in the UI as the model produces it.
pub type TokenSink<'a> = &'a (dyn Fn(&str) + Send + Sync);

fn record(step: ChatStep, steps: &mut Vec<ChatStep>, on_step: StepSink<'_>) {
    on_step(&step);
    steps.push(step);
}

/// Read an SSE response body incrementally, invoking `on_data` with each
/// `data:` payload (raw JSON string; blank lines and `[DONE]` skipped). All
/// three providers stream newline-delimited `data:` events, so one reader
/// serves them all — only the per-event parsing differs.
async fn drive_sse(
    mut resp: reqwest::Response,
    mut on_data: impl FnMut(&str) -> Result<(), String>,
) -> Result<(), String> {
    let mut buf = String::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("stream read: {e}"))? {
        buf.push_str(&String::from_utf8_lossy(chunk.as_ref()));
        while let Some(nl) = buf.find('\n') {
            let line: String = buf.drain(..=nl).collect();
            let line = line.trim();
            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if data.is_empty() || data == "[DONE]" {
                    continue;
                }
                on_data(data)?;
            }
        }
    }
    Ok(())
}

async fn exec_tool(
    name: &str,
    args: &Value,
    runner: &dyn SqlRunner,
    steps: &mut Vec<ChatStep>,
    proposed: &mut Vec<String>,
    on_step: StepSink<'_>,
    dialect: &str,
) -> Value {
    match name {
        "list_tables" => {
            let sql = list_tables_sql(dialect);
            match runner.run_readonly(&sql).await {
                Ok(rows) => {
                    let names: Vec<String> = rows
                        .iter()
                        .filter_map(|r| {
                            r.as_object()
                                .and_then(|o| o.values().next())
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                        })
                        .collect();
                    record(
                        ChatStep { kind: "list_tables".into(), sql: "list_tables".into(), ok: true, summary: format!("{} table(s)", names.len()) },
                        steps,
                        on_step,
                    );
                    json!({ "tables": names })
                }
                Err(e) => {
                    record(
                        ChatStep { kind: "list_tables".into(), sql: "list_tables".into(), ok: false, summary: e.clone() },
                        steps,
                        on_step,
                    );
                    json!({ "error": e })
                }
            }
        }
        "describe_table" => {
            let table = args.get("table").and_then(|s| s.as_str()).unwrap_or("").trim().to_string();
            if table.is_empty() {
                return json!({ "error": "missing table argument" });
            }
            let sql = describe_table_sql(dialect, &table);
            match runner.run_readonly(&sql).await {
                Ok(rows) => {
                    record(
                        ChatStep { kind: "describe_table".into(), sql: format!("describe_table({table})"), ok: true, summary: format!("{} column(s)", rows.len()) },
                        steps,
                        on_step,
                    );
                    json!({ "columns": rows })
                }
                Err(e) => {
                    record(
                        ChatStep { kind: "describe_table".into(), sql: format!("describe_table({table})"), ok: false, summary: e.clone() },
                        steps,
                        on_step,
                    );
                    json!({ "error": e })
                }
            }
        }
        "run_sql" => {
            let sql = args.get("sql").and_then(|s| s.as_str()).unwrap_or("").trim().to_string();
            if sql.is_empty() {
                return json!({ "error": "empty sql" });
            }
            if !is_read_only(&sql) {
                record(
                    ChatStep { kind: "run_sql".into(), sql, ok: false, summary: "blocked: not read-only".into() },
                    steps,
                    on_step,
                );
                return json!({ "error": "This statement is not read-only. Use propose_write for any change." });
            }
            // Anti-repeat guard: if this exact query already failed this turn,
            // don't re-run it — push the agent to introspect instead of looping.
            if let Some(prev) = steps.iter().find(|s| s.kind == "run_sql" && !s.ok && s.sql == sql) {
                return json!({ "error": format!(
                    "You already ran this exact query and it failed ({}). Do NOT repeat it — call list_tables / describe_table to find the correct, exact (possibly quoted) names, then write a different query.",
                    prev.summary
                ) });
            }
            match runner.run_readonly(&sql).await {
                Ok(rows) => {
                    let total = rows.len();
                    let truncated = total > MAX_ROWS_TO_MODEL;
                    let shown: Vec<Value> = rows.into_iter().take(MAX_ROWS_TO_MODEL).collect();
                    record(
                        ChatStep { kind: "run_sql".into(), sql, ok: true, summary: format!("{total} row(s)") },
                        steps,
                        on_step,
                    );
                    json!({ "rows": shown, "rowCount": total, "truncated": truncated })
                }
                Err(e) => {
                    record(
                        ChatStep { kind: "run_sql".into(), sql, ok: false, summary: e.clone() },
                        steps,
                        on_step,
                    );
                    json!({ "error": e })
                }
            }
        }
        "propose_write" => {
            let sql = args.get("sql").and_then(|s| s.as_str()).unwrap_or("").trim().to_string();
            if !sql.is_empty() {
                proposed.push(sql.clone());
                record(
                    ChatStep { kind: "propose_write".into(), sql, ok: true, summary: "proposed for review".into() },
                    steps,
                    on_step,
                );
            }
            json!({ "status": "proposed to the user for review and manual execution" })
        }
        other => json!({ "error": format!("unknown tool: {other}") }),
    }
}

fn fn_response(name: &str, response: Value) -> Value {
    json!({ "functionResponse": { "name": name, "response": response } })
}

async fn chat_google(
    api_key: &str,
    model: &str,
    runner: &dyn SqlRunner,
    messages: Vec<ChatMessage>,
    dialect: &str,
    schema: &str,
    on_step: StepSink<'_>,
    on_token: TokenSink<'_>,
) -> Result<ChatResponse, String> {
    let system = chat_system_prompt(dialect, schema);

    let mut contents: Vec<Value> = messages
        .iter()
        .map(|m| {
            let role = if m.role == "assistant" { "model" } else { "user" };
            json!({ "role": role, "parts": [{ "text": m.content }] })
        })
        .collect();

    let tools = json!([{
        "functionDeclarations": [
            { "name": "list_tables", "description": LIST_TABLES_DESC, "parameters": no_params() },
            { "name": "describe_table", "description": DESCRIBE_TABLE_DESC, "parameters": describe_params() },
            { "name": "run_sql", "description": RUN_SQL_DESC, "parameters": run_sql_params() },
            { "name": "propose_write", "description": PROPOSE_DESC, "parameters": propose_params() }
        ]
    }]);

    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
    );
    let mut steps: Vec<ChatStep> = Vec::new();
    let mut proposed: Vec<String> = Vec::new();

    for _ in 0..MAX_AGENT_STEPS {
        let body = json!({
            "system_instruction": { "parts": [{ "text": system }] },
            "contents": contents,
            "tools": tools,
            "toolConfig": { "functionCallingConfig": { "mode": "AUTO" } },
            "generationConfig": { "maxOutputTokens": MAX_TOKENS, "temperature": 0 }
        });

        let resp = client
            .post(&url)
            .header("x-goog-api-key", api_key)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("AI request failed: {e}"))?;
        let http_status = resp.status();
        if !http_status.is_success() {
            let text = resp.text().await.map_err(|e| format!("could not read AI response: {e}"))?;
            return Err(format!("AI request failed ({http_status}): {}", error_message(&text)));
        }

        let mut text_out = String::new();
        let mut fn_calls: Vec<(String, Value)> = Vec::new();
        let mut block_reason: Option<String> = None;

        drive_sse(resp, |data| {
            let v: Value = serde_json::from_str(data).map_err(|e| format!("parse stream: {e}"))?;
            if let Some(r) = v
                .get("promptFeedback")
                .and_then(|f| f.get("blockReason"))
                .and_then(|r| r.as_str())
            {
                block_reason = Some(r.to_string());
            }
            if let Some(parts) = v
                .get("candidates")
                .and_then(|c| c.as_array())
                .and_then(|a| a.first())
                .and_then(|c| c.get("content"))
                .and_then(|c| c.get("parts"))
                .and_then(|p| p.as_array())
            {
                for part in parts {
                    if let Some(fc) = part.get("functionCall") {
                        let name = fc.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                        let args = fc.get("args").cloned().unwrap_or_else(|| json!({}));
                        fn_calls.push((name, args));
                    } else if let Some(t) = part.get("text").and_then(|t| t.as_str()) {
                        text_out.push_str(t);
                        on_token(t);
                    }
                }
            }
            Ok(())
        })
        .await?;

        if let Some(r) = block_reason {
            return Err(format!("The model declined this request ({r})."));
        }

        // No tool calls → this is the final answer.
        if fn_calls.is_empty() {
            return Ok(ChatResponse {
                reply: text_out.trim().to_string(),
                steps,
                proposed_writes: proposed,
            });
        }

        // Reconstruct the model turn (text + functionCall parts) so the
        // functionCall/response pairing Gemini expects stays intact.
        let mut model_parts: Vec<Value> = Vec::new();
        if !text_out.is_empty() {
            model_parts.push(json!({ "text": text_out }));
        }
        for (name, args) in &fn_calls {
            model_parts.push(json!({ "functionCall": { "name": name, "args": args } }));
        }
        contents.push(json!({ "role": "model", "parts": model_parts }));

        let mut response_parts: Vec<Value> = Vec::new();
        for (name, args) in fn_calls {
            let result = exec_tool(&name, &args, runner, &mut steps, &mut proposed, on_step, dialect).await;
            response_parts.push(fn_response(&name, result));
        }
        contents.push(json!({ "role": "user", "parts": response_parts }));
    }

    Ok(step_limit_response(steps, proposed))
}

fn step_limit_response(steps: Vec<ChatStep>, proposed: Vec<String>) -> ChatResponse {
    ChatResponse {
        reply: "I couldn't finish within the step limit — try narrowing the question.".into(),
        steps,
        proposed_writes: proposed,
    }
}

async fn chat_anthropic(
    api_key: &str,
    model: &str,
    runner: &dyn SqlRunner,
    messages: Vec<ChatMessage>,
    dialect: &str,
    schema: &str,
    on_step: StepSink<'_>,
    on_token: TokenSink<'_>,
) -> Result<ChatResponse, String> {
    let system = chat_system_prompt(dialect, schema);

    // Anthropic message turns: text content to start; tool_use / tool_result
    // blocks accumulate as the loop runs.
    let mut msgs: Vec<Value> = messages
        .iter()
        .map(|m| {
            let role = if m.role == "assistant" { "assistant" } else { "user" };
            json!({ "role": role, "content": m.content })
        })
        .collect();

    let tools = json!([
        { "name": "list_tables", "description": LIST_TABLES_DESC, "input_schema": no_params() },
        { "name": "describe_table", "description": DESCRIBE_TABLE_DESC, "input_schema": describe_params() },
        { "name": "run_sql", "description": RUN_SQL_DESC, "input_schema": run_sql_params() },
        { "name": "propose_write", "description": PROPOSE_DESC, "input_schema": propose_params() }
    ]);

    let client = reqwest::Client::new();
    let mut steps: Vec<ChatStep> = Vec::new();
    let mut proposed: Vec<String> = Vec::new();

    for _ in 0..MAX_AGENT_STEPS {
        let body = json!({
            "model": model,
            "max_tokens": MAX_TOKENS,
            "system": system,
            "tools": tools,
            "messages": msgs,
            "stream": true
        });

        let resp = client
            .post(ANTHROPIC_URL)
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("AI request failed: {e}"))?;
        let http_status = resp.status();
        if !http_status.is_success() {
            let text = resp.text().await.map_err(|e| format!("could not read AI response: {e}"))?;
            return Err(format!("AI request failed ({http_status}): {}", error_message(&text)));
        }

        // Stream blocks: text_delta streams the answer; tool_use blocks arrive
        // as a content_block_start (id/name) then input_json_delta fragments,
        // finalized at content_block_stop.
        let mut text_out = String::new();
        let mut tool_blocks: HashMap<u64, (String, String, String)> = HashMap::new();
        let mut tool_uses: Vec<(String, String, Value)> = Vec::new(); // id, name, input
        let mut stop_reason: Option<String> = None;

        drive_sse(resp, |data| {
            let v: Value = serde_json::from_str(data).map_err(|e| format!("parse stream: {e}"))?;
            match v.get("type").and_then(|t| t.as_str()) {
                Some("content_block_start") => {
                    let idx = v.get("index").and_then(|i| i.as_u64()).unwrap_or(0);
                    let cb = v.get("content_block");
                    if cb.and_then(|c| c.get("type")).and_then(|t| t.as_str()) == Some("tool_use") {
                        let id = cb.and_then(|c| c.get("id")).and_then(|s| s.as_str()).unwrap_or("").to_string();
                        let name = cb.and_then(|c| c.get("name")).and_then(|s| s.as_str()).unwrap_or("").to_string();
                        tool_blocks.insert(idx, (id, name, String::new()));
                    }
                }
                Some("content_block_delta") => {
                    let idx = v.get("index").and_then(|i| i.as_u64()).unwrap_or(0);
                    let d = v.get("delta");
                    match d.and_then(|d| d.get("type")).and_then(|t| t.as_str()) {
                        Some("text_delta") => {
                            if let Some(t) = d.and_then(|d| d.get("text")).and_then(|t| t.as_str()) {
                                text_out.push_str(t);
                                on_token(t);
                            }
                        }
                        Some("input_json_delta") => {
                            if let Some(pj) = d.and_then(|d| d.get("partial_json")).and_then(|t| t.as_str()) {
                                if let Some(b) = tool_blocks.get_mut(&idx) {
                                    b.2.push_str(pj);
                                }
                            }
                        }
                        _ => {}
                    }
                }
                Some("content_block_stop") => {
                    let idx = v.get("index").and_then(|i| i.as_u64()).unwrap_or(0);
                    if let Some((id, name, json_acc)) = tool_blocks.remove(&idx) {
                        let input: Value = if json_acc.trim().is_empty() {
                            json!({})
                        } else {
                            serde_json::from_str(&json_acc).unwrap_or_else(|_| json!({}))
                        };
                        tool_uses.push((id, name, input));
                    }
                }
                Some("message_delta") => {
                    if let Some(sr) = v.get("delta").and_then(|d| d.get("stop_reason")).and_then(|s| s.as_str()) {
                        stop_reason = Some(sr.to_string());
                    }
                }
                Some("error") => {
                    let msg = v
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|m| m.as_str())
                        .unwrap_or("stream error");
                    return Err(format!("AI stream error: {msg}"));
                }
                _ => {}
            }
            Ok(())
        })
        .await?;

        if stop_reason.as_deref() == Some("refusal") {
            return Err("The model declined this request.".to_string());
        }

        if tool_uses.is_empty() {
            return Ok(ChatResponse {
                reply: text_out.trim().to_string(),
                steps,
                proposed_writes: proposed,
            });
        }

        // Reconstruct the assistant turn (text + tool_use blocks) so the
        // tool_use/tool_result pairing stays intact, then answer each call.
        let mut content: Vec<Value> = Vec::new();
        if !text_out.is_empty() {
            content.push(json!({ "type": "text", "text": text_out }));
        }
        for (id, name, input) in &tool_uses {
            content.push(json!({ "type": "tool_use", "id": id, "name": name, "input": input }));
        }
        msgs.push(json!({ "role": "assistant", "content": content }));

        let mut results: Vec<Value> = Vec::new();
        for (id, name, input) in tool_uses {
            let result = exec_tool(&name, &input, runner, &mut steps, &mut proposed, on_step, dialect).await;
            let is_error = result.get("error").is_some();
            results.push(json!({
                "type": "tool_result",
                "tool_use_id": id,
                "content": result.to_string(),
                "is_error": is_error
            }));
        }
        msgs.push(json!({ "role": "user", "content": results }));
    }

    Ok(step_limit_response(steps, proposed))
}

async fn chat_openai(
    api_key: &str,
    model: &str,
    runner: &dyn SqlRunner,
    messages: Vec<ChatMessage>,
    dialect: &str,
    schema: &str,
    on_step: StepSink<'_>,
    on_token: TokenSink<'_>,
) -> Result<ChatResponse, String> {
    let system = chat_system_prompt(dialect, schema);

    let mut msgs: Vec<Value> = vec![json!({ "role": "system", "content": system })];
    msgs.extend(messages.iter().map(|m| {
        let role = if m.role == "assistant" { "assistant" } else { "user" };
        json!({ "role": role, "content": m.content })
    }));

    let tools = json!([
        { "type": "function", "function": { "name": "list_tables", "description": LIST_TABLES_DESC, "parameters": no_params() } },
        { "type": "function", "function": { "name": "describe_table", "description": DESCRIBE_TABLE_DESC, "parameters": describe_params() } },
        { "type": "function", "function": { "name": "run_sql", "description": RUN_SQL_DESC, "parameters": run_sql_params() } },
        { "type": "function", "function": { "name": "propose_write", "description": PROPOSE_DESC, "parameters": propose_params() } }
    ]);

    let client = reqwest::Client::new();
    let mut steps: Vec<ChatStep> = Vec::new();
    let mut proposed: Vec<String> = Vec::new();

    for _ in 0..MAX_AGENT_STEPS {
        let body = json!({
            "model": model,
            "max_tokens": MAX_TOKENS,
            "messages": msgs,
            "tools": tools,
            "tool_choice": "auto",
            "stream": true
        });

        let resp = client
            .post(OPENAI_URL)
            .header("authorization", format!("Bearer {api_key}"))
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("AI request failed: {e}"))?;
        let http_status = resp.status();
        if !http_status.is_success() {
            let text = resp.text().await.map_err(|e| format!("could not read AI response: {e}"))?;
            return Err(format!("AI request failed ({http_status}): {}", error_message(&text)));
        }

        // Stream deltas: `content` is the answer text; `tool_calls` arrive as
        // fragments keyed by index — id/name come first, `arguments` (a JSON
        // string) accumulates across deltas.
        let mut text_out = String::new();
        let mut tcs: Vec<(String, String, String)> = Vec::new(); // id, name, args
        let mut refused = false;

        drive_sse(resp, |data| {
            let v: Value = serde_json::from_str(data).map_err(|e| format!("parse stream: {e}"))?;
            let choice = v.get("choices").and_then(|c| c.as_array()).and_then(|a| a.first());
            if choice.and_then(|c| c.get("finish_reason")).and_then(|r| r.as_str()) == Some("content_filter") {
                refused = true;
            }
            if let Some(delta) = choice.and_then(|c| c.get("delta")) {
                if let Some(t) = delta.get("content").and_then(|c| c.as_str()) {
                    if !t.is_empty() {
                        text_out.push_str(t);
                        on_token(t);
                    }
                }
                if let Some(calls) = delta.get("tool_calls").and_then(|t| t.as_array()) {
                    for call in calls {
                        let idx = call.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize;
                        while tcs.len() <= idx {
                            tcs.push((String::new(), String::new(), String::new()));
                        }
                        if let Some(id) = call.get("id").and_then(|s| s.as_str()) {
                            if !id.is_empty() {
                                tcs[idx].0 = id.to_string();
                            }
                        }
                        if let Some(f) = call.get("function") {
                            if let Some(n) = f.get("name").and_then(|s| s.as_str()) {
                                if !n.is_empty() {
                                    tcs[idx].1 = n.to_string();
                                }
                            }
                            if let Some(a) = f.get("arguments").and_then(|s| s.as_str()) {
                                tcs[idx].2.push_str(a);
                            }
                        }
                    }
                }
            }
            Ok(())
        })
        .await?;

        if refused {
            return Err("The model declined this request.".to_string());
        }

        if tcs.is_empty() {
            return Ok(ChatResponse {
                reply: text_out.trim().to_string(),
                steps,
                proposed_writes: proposed,
            });
        }

        // Reconstruct the assistant message (with tool_calls) for the next turn.
        let assistant_tool_calls: Vec<Value> = tcs
            .iter()
            .map(|(id, name, args)| {
                json!({ "id": id, "type": "function", "function": { "name": name, "arguments": args } })
            })
            .collect();
        let mut assistant_msg = json!({ "role": "assistant", "tool_calls": assistant_tool_calls });
        if !text_out.is_empty() {
            assistant_msg["content"] = json!(text_out);
        }
        msgs.push(assistant_msg);

        for (id, name, args_str) in tcs {
            let args: Value = serde_json::from_str(&args_str).unwrap_or_else(|_| json!({}));
            let result = exec_tool(&name, &args, runner, &mut steps, &mut proposed, on_step, dialect).await;
            msgs.push(json!({
                "role": "tool",
                "tool_call_id": id,
                "content": result.to_string()
            }));
        }
    }

    Ok(step_limit_response(steps, proposed))
}
