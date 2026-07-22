# Implementation Plan — AI via Local Authenticated CLI Agent

**Status:** proposed
**Scope:** Additive. The existing BYO-API-key AI (`Provider::{Anthropic,OpenAi,Google}` in `src-tauri/src/ai.rs`) is **not** removed. This adds a new opt-in path that drives a user's already-authenticated local CLI agent (Claude Code `claude` first; pluggable to Gemini CLI, Codex, cursor-agent) so users don't paste a key and don't pay per-token.

---

## 1. Goals & non-goals

**Goals**
- Let a user pick "Use my local CLI agent" instead of an API key.
- Full agentic quality: the local agent plans and calls back into justdb's tools.
- All interaction stays inside justdb's own `ai-chat-panel` — the CLI runs headless (`claude -p`), no external chat UI.
- Pluggable across CLI agents via a capability-gated adapter.

**Non-goals (this plan)**
- Replacing or changing the existing key-based providers.
- Shipping every agent at once — Phase 1 targets Claude Code only.
- Server-side/cloud anything. Everything is local to the user's machine.

---

## 2. Key architectural decision — MCP transport

The agent needs to call back into justdb's DB tools. Two transports:

| | stdio subprocess (`justdb --mcp-serve`) — **v1** | In-process localhost HTTP (future) |
|---|---|---|
| Connection | Reopens from creds (read-only, same committed data) | Reuses the live `Arc<DbConnection>` |
| DB sessions | 2 (fine for a read-only assistant) | 1 (the one the user sees) |
| Steps in UI | Reconstructed from the stream (verified in Phase 0) | Server can emit `ai-chat-step` directly |
| New dependency | **none** — tokio process + a tiny JSON-RPC stdio loop | `rmcp` + `axum` + unproven streamable-HTTP handshake |
| Proven? | ✅ end-to-end in Phase 0 | ❌ not yet |

**Decision (v1): stdio subprocess.** Phase 0 proved the stdio tool-call loop works headlessly with zero new dependencies, and that the stream carries everything needed to reconstruct `ChatStep`s (`tool_use.input.sql` + `tool_result` rows). Reaching the live connection would *require* either an in-process HTTP socket (heavy `rmcp`+`axum`, unproven handshake) or a reopened connection — and for a **read-only** assistant a second read-only connection sees the same committed data, so the fidelity cost is negligible. In-process HTTP is the documented upgrade if live-session fidelity ever matters.

> `run_sql`'s `is_read_only` gate lives **inside the tool**, unchanged — transport choice does not affect the safety model.

### 2.1 Phase 0 — verified facts (claude 2.1.197, macOS)
- Binary: `/opt/homebrew/bin/claude` (also probe `~/.local/bin`, npm prefix, `/usr/local/bin`).
- Invocation: `claude -p "<prompt>" --output-format stream-json --include-partial-messages --verbose --model <m> --mcp-config <file> --allowedTools "mcp__justdb__run_sql,…" --permission-mode default < /dev/null`
- **`--verbose` is REQUIRED** with `--print --output-format=stream-json` (errors otherwise).
- **`--permission-mode default` + explicit `--allowedTools` auto-approves our MCP tools headlessly** → `permission_denials: []`, no prompt. (This also confines the agent to *only* our tools.)
- Close/redirect stdin (`< /dev/null`) or it waits ~3s for stdin.
- Stream events (NDJSON, one JSON object per line, field `type`):
  - `stream_event` → `event.type=="content_block_delta"` → `delta.type=="text_delta"` → `delta.text` = answer token (`on_token`). Skip `thinking_delta` / `signature_delta`.
  - `assistant` → `message.content[]` blocks; `tool_use` block = `{name:"mcp__justdb__run_sql", input:{sql}}`.
  - `user` → `message.content[]`; `tool_result` block = `{content:[{type:"text", text:<our JSON rows>}], is_error}`.
  - `result` (final, once) → `{subtype, is_error, result:<final text>, session_id, total_cost_usd, permission_denials, stop_reason}`.
- MCP stdio wire: newline-delimited JSON-RPC 2.0; methods `initialize` (reply protocolVersion/capabilities/serverInfo), `notifications/initialized` (no reply), `tools/list`, `tools/call` (reply `{content:[{type:"text",text}]}`).

---

## 3. Data flow (one chat turn) — stdio (v1)

```
ai_chat (lib.rs)  ── provider == ClaudeCli ──►  chat_claude_cli (ai.rs)
   │                                                 │
   │ 1. write temp mcp-config.json → { justdb: { type:"stdio",
   │      command:"<self exe>", args:["--mcp-serve","--conn-id","<id>","--dialect","pg"] } }
   │ 2. spawn: claude -p <prompt> --output-format stream-json --include-partial-messages
   │      --verbose --mcp-config <file> --allowedTools mcp__justdb__* --permission-mode default </dev/null
   │                                                 │
   │                                     claude spawns the stdio server ──►  justdb --mcp-serve  (mcp.rs)
   │                                                 │                          │ reopen read-only conn (conn-id)
   │                                                 │                          │ tools/list, tools/call
   │                                                 │                          │ is_read_only(sql) gate
   │                                                 │                          │ exec_tool_body → rows JSON
   │  read stdout NDJSON  ◄──────────────────────────┘
   │   → on_token(text_delta); on tool_use/tool_result → on_step(reconstructed ChatStep)
   │   → capture final result + session_id
   ▼
ChatResponse { reply, steps, proposed_writes }
```

Division of labor:
- **MCP server (`mcp.rs`, subprocess)** executes tools against a reopened read-only connection; enforces `is_read_only`; returns rows. It does not touch the UI.
- **Stream parser (`chat_claude_cli`)** owns everything the UI sees: `text_delta` → `ai-chat-token`; each `tool_use` (+ its `tool_result`) → a reconstructed `ChatStep` via `ai-chat-step` (SQL from `tool_use.input.sql`, preview from the `tool_result` rows through `preview_table`); `propose_write` tool_use → `proposed_writes`; final `result` → reply + `session_id`.

The webview receives the **same `ai-chat-step` / `ai-chat-token` events it already handles** — it can't tell the CLI path from a key-based provider.

---

## 4. File-by-file changes

### 4.1 `src-tauri/Cargo.toml`
- **No new MCP/HTTP deps** — the stdio server is a tiny hand-rolled JSON-RPC loop over stdin/stdout on the existing `tokio` + `serde_json` (contract verified in Phase 0).
- Add `which = "6"` (or hand-roll) for cross-platform binary discovery.

### 4.2 `src-tauri/src/mcp.rs` — NEW, stdio MCP server (subprocess mode)
- Entry `pub async fn serve_stdio(conn_id: String, dialect: String) -> !` — invoked when the binary is started as `justdb --mcp-serve` (dispatched early in `run()` before Tauri boots). Reopens a **read-only** connection for `conn_id` by reusing the existing connect path (creds from keychain / `saved_connections`), builds a `SessionRunner`, then runs the JSON-RPC loop.
- JSON-RPC loop (newline-delimited, per Phase 0): `initialize` → `{protocolVersion, capabilities:{tools:{}}, serverInfo}`; `notifications/initialized` → ignore; `tools/list` → the four tool schemas; `tools/call` → dispatch to `exec_tool_body`, wrap result as `{content:[{type:"text", text:<json>}]}`.
- Four tools from the existing schemas `run_sql_params()` / `propose_params()` / `no_params()` / `describe_params()` (make `pub(crate)` in `ai.rs`):
  - `run_sql` → `if !ai::is_read_only(sql) { error }` then `runner.run_readonly` → rows JSON.
  - `list_tables` / `describe_table` → reuse `list_tables_sql` / `describe_table_sql`.
  - `propose_write` → **never executes**; returns an ack echoing the SQL (the parent reconstructs the proposed-write from the `tool_use` in the stream and routes it through the UI confirmation flow).
- Refactor: extract the per-tool bodies in `ai.rs::exec_tool` into `pub(crate) async fn exec_tool_body(name, args, runner, dialect) -> Value` so both the existing in-Rust loop and `mcp.rs` share them, keeping `is_read_only` as the single gate.

### 4.3 `src-tauri/src/ai.rs`
- `enum Provider` → add `ClaudeCli` (and later a generic `LocalAgent(AgentId)`). `parse` accepts `"claude-cli"` / `"local:claude"`.
- `AiConfig` → make `api_key` optional (local agents have none). `AiStatus.configured` true when a local agent is selected + detected.
- New `async fn chat_claude_cli(messages, model, session_ctx, on_step, on_token) -> Result<ChatResponse>`:
  - `resolve_agent_bin("claude")` — absolute path (see 4.6); build args (§5).
  - `tokio::process::Command` spawn, `Stdio::piped()`.
  - `drive_ndjson(stdout, |ev| …)` — the NDJSON sibling of the existing `drive_sse`: read lines, `serde_json::from_str`, dispatch by `ev["type"]`.
  - Return `ChatResponse` assembled from the streamed reply + the server-collected steps/proposed writes (read back from `AppState` after child exit).
- `fn resolve_agent_bin`, `fn write_mcp_config(port, token) -> TempPath`, `fn drive_ndjson(...)`, `fn handle_stream_event(...)`.
- `set_key` path: allow selecting a local provider with an empty key (store `{provider, model}` only).

### 4.4 `src-tauri/src/lib.rs`
- **`run()` early-dispatch:** before the Tauri builder, check `std::env::args()` for `--mcp-serve`; if present, parse `--conn-id`/`--dialect`, `block_on(mcp::serve_stdio(...))`, and exit. Keeps the MCP subprocess out of the whole Tauri/window stack.
- `AppState` gains `children: DashMap<String, Child>` for cancellation. (No token/port maps — stdio needs none.)
- `ai_chat`: branch on the stored provider. Existing providers → unchanged in-process `ai::chat`. `ClaudeCli` → `ai::chat_claude_cli(session_ctx, on_step, on_token)`; the existing `window.emit("ai-chat-step"/"ai-chat-token")` sinks are reused verbatim (steps are reconstructed by the parser, so they flow through the same closures). Register the child in `children` for cancel; remove on exit.
- New command `ai_local_agents() -> Vec<LocalAgentInfo>` — detection (§4.6) for the settings UI.
- New command `ai_cancel(session_id)` — kill the child in `AppState.children` (the existing key path has no cancel; add for the potentially longer agent runs).
- Register the new commands in `invoke_handler!`.

### 4.5 Frontend — `apps/web/src/components/settings-modal.tsx` + `ai-chat-panel.tsx`
- Settings: add a provider option "Local CLI agent (uses your existing login)". When selected, hide the API-key field; call `ai_local_agents` and show detected agents + auth state; if none detected, show install/login hint. Persist via the existing `ai_set_key` command with an empty key.
- Chat panel: no structural change — same `ai-chat-step` / `ai-chat-token` events. Optionally show a subtle "via local Claude Code" badge and a Cancel button wired to `ai_cancel`.

### 4.6 Binary & auth detection (`resolve_agent_bin` / `ai_local_agents`)
- **PATH is stripped under Finder/Dock** — do not rely on bare `claude`. Probe, in order: `which`/`where`, `~/.local/bin/claude(.exe)`, npm global prefix, Homebrew `/usr/local/bin` & `/opt/homebrew/bin`, `%USERPROFILE%\.local\bin\claude.exe`.
- Auth check: run `claude --version` (fast, succeeds without login) to confirm presence; treat auth as "assumed, verified on first real run" — surface a clear error if the first `-p` run returns an auth failure rather than pre-flighting a token.
- `LocalAgentInfo { id, name, path, present, supports_mcp }`.

---

## 5. Claude Code invocation (verify flags against installed version — §8)

```
claude -p "<prompt>"
  --output-format stream-json
  --include-partial-messages          # token deltas (else whole-message granularity)
  --verbose                           # stream-json in -p mode may require this
  --model <model>
  --mcp-config <temp path>            # { mcpServers: { justdb: { type:"http",
                                      #   url:"http://127.0.0.1:PORT/mcp",
                                      #   headers:{ Authorization:"Bearer <token>" } } } }
  --allowedTools "mcp__justdb__run_sql,mcp__justdb__list_tables,mcp__justdb__describe_table,mcp__justdb__propose_write"
  --permission-mode <non-interactive value>
env: CLAUDE_CONFIG_DIR=<justdb agent dir>   # isolate from user's personal ~/.claude history
```

Multi-turn: stash `session_id` from the final `result` event; next turn pass `--resume <session_id>` and send only the new user message.

**Stream event → sink mapping**

| event `type` | extract | action |
|---|---|---|
| partial `stream_event` text delta | delta | `on_token(delta)` + append reply |
| `assistant` … `tool_use` | (server already handled it) | ignore for steps |
| `result` (final) | `.result`, `.session_id`, `.is_error`, `.total_cost_usd` | finalize reply / session; on `is_error` → surface |

---

## 6. Phasing

- **Phase 0 — Spike (0.5d):** run `claude -p --output-format stream-json --mcp-config` by hand against a throwaway HTTP MCP server; confirm exact flags (`--verbose`, partial-messages, `--permission-mode`) and the event envelope. Locks §5.
- **Phase 1 — MCP server (`mcp.rs`) — ✅ DONE & PROVEN.** Stdio JSON-RPC server (`justdb --mcp-serve`), four tools via `ai::exec_tool_body` + `is_read_only`, reopens read-only connection from `JUSTDB_MCP_CONFIG`. Verified: (a) `cargo check`/`build` green; (b) piped JSON-RPC — initialize/tools-list/tools-call all correct, `DELETE` blocked with `isError`; (c) **real `claude -p` drove the real binary end-to-end** — chained list_tables→describe_table→run_sql, `permission_denials:[]`, secret off-disk via `${VAR}` env-indirection.
- **Phase 2 — `chat_claude_cli` + wiring (2d):** spawn, `drive_ndjson`, `Provider::ClaudeCli`, `ai_chat` routing, cancellation. End-to-end in the real panel.
- **Phase 3 — Detection + settings UI — ✅ DONE.** `ai_local_agents` command + `ai.localAgents()` client; `claude-cli` provider in `PROVIDERS` (keyless, `local: true`); settings-modal shows a detection panel (found/​not-found + path) instead of the key field, honest ToS copy, keyless save. Typechecks; HMR-applied to the running app.
- **Phase 4 — Multi-agent (later):** `LocalAgent` adapter trait with `supports_mcp`; add Gemini CLI / Codex; text→SQL fallback (reuse the existing in-Rust loop as the model call) for non-MCP agents.
- **Phase 5 — Hardening (later):** history isolation dir, resume, robust error surfacing, timeouts, cost display.

---

## 7. Security & safety
- `is_read_only` stays the single gate, enforced **inside** `run_sql` in `mcp.rs` — never trust the driving agent.
- `propose_write` never executes; SQL is buffered and routed through the existing UI confirmation flow.
- MCP server binds `127.0.0.1` only; every request requires a random per-session bearer token that maps to exactly one session and is removed when the turn ends.
- API keys / creds never reach the webview (unchanged). Local agents carry no key at all.
- `CLAUDE_CONFIG_DIR` isolates justdb's agent sessions from the user's personal Claude Code history.
- Cancellation kills the child process and evicts its token.

## 8. Open items to resolve
1. **ToS — resolved stance (no redistribution).** justdb is an open-source *launcher*: it bundles nothing of Anthropic's (no binary, key, or weights) and consumes no Anthropic resources itself — the user's own independently-installed, authenticated agent does. So there is no redistribution / derivative-work concern; this is on par with any OSS that wraps `claude`/`gh`/`aws`. The only residual question — whether a user may drive their own Pro/Max subscription programmatically — is governed by **the user's** agreement with Anthropic, not justdb's. Proportionate safeguard: state it plainly in the settings UI and docs ("Uses your own installed, authenticated Claude Code; subject to your agreement with Anthropic"). No pre-GA sign-off treated as a blocker.
2. Exact CLI flags (Phase 0): `--verbose` requirement, token-delta flag name, non-interactive `--permission-mode` value.
3. rmcp version + whether its HTTP-server transport is stable enough, or hand-roll a minimal JSON-RPC-over-HTTP endpoint on a tiny axum router.
4. Multi-window future: today there's one main window, so `app.emit` is fine; revisit if multi-window lands.

## 9. Testing
- Unit: `drive_ndjson` parsing (canned stream-json fixtures incl. `is_error`), token→session auth (reject unknown/expired), `exec_tool_body` parity with existing tests, `is_read_only` (already covered) reused by the MCP path.
- Integration: script that pipes a recorded stream-json into `handle_stream_event`; a live `claude -p` smoke test behind a feature/env gate (needs a logged-in machine).
- Manual: end-to-end in the panel — read query, multi-step exploration, a `propose_write` gated by the UI, cancel mid-run.
