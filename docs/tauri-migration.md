# Tauri migration plan

Ship JustDB as a native desktop app so user database credentials and queries never leave their machine. The hosted SaaS at justdb.kreativekorna.com stays unchanged — it becomes the mobile / playground / "try without installing" entry point. Desktop is the trust anchor.

This plan is the path from the `tauri-spike` branch (commit `e419b3c`) to a shippable v1.

---

## Phasing overview

| Phase | Outcome | Endpoints ported | Risk |
| --- | --- | --- | --- |
| 0 ✅ | Spike (done) | `connect`, `query`, `disconnect` (proof-of-concept) | retired |
| 0.5 ✅ | Dual-build config: SaaS keeps `/api`, desktop excludes it | none | medium — Next.js `output: 'export'` doesn't tolerate `/api` |
| 1 ✅ | Read-only browsing works in desktop window | `connect`, `disconnect`, `tables`, `schemas`, `table` (data + columns), `health` | low |
| 2 | Mutations + edit flow | `mutate`, `mutate-batch`, `lookup-row` | medium — staged-edit/FK-navigator UI surface |
| 3 | DDL + schema explorer | `ddl`, `schema*`, `relationships`, `cascade-preview` | medium — pg_catalog queries are pg-specific |
| 4 | Explain + perf + extras | `explain`, `performance`, `functions`, `views`, `table-counts`, `table-stats` | low |
| 5 | Import/export + saved connections in OS keychain | `import`, `upload-sqlite`, `saved-connections` | medium — filesystem semantics differ, keychain is platform-specific |
| 6 | Polish + ship | n/a | medium — code signing, auto-update, bundle size |

Each phase is independently shippable as a desktop release. Phase 1 alone is a useful tool ("read-only Postgres browser"). Phase 2 unlocks parity with SaaS for the most common workflow.

---

## Phase 0.5 — Dual-build config (gating)

The single biggest non-obvious problem in the migration: Next.js `output: 'export'` (which Tauri's prod build needs) refuses to build a project with `app/api/*` route handlers. The SaaS depends on those route handlers. We need both to work from the same repo.

### Options considered

| Approach | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Workspace split — move `/api` to a separate Next/Hono app | Cleanest long-term, real separation of concerns | Days of refactor, two build pipelines | Defer to Phase 6 |
| Branch divergence — long-lived `desktop` branch with `/api` deleted | No tooling needed | Constant merge pain | Avoid |
| Pre-build directory rename (`app/api` → `app/__api_excluded__`) via a script | Zero refactor, reversible, contained to a single npm script | Fragile, leaves the working tree dirty if the script crashes mid-build | **Pick for Phase 1** |
| Custom Next build with `pageExtensions` trick | Native Next.js feature | `pageExtensions` filters extensions not directories — can't exclude `/api` cleanly | Not viable |

### Implementation for Phase 1

`scripts/prepare-tauri-build.mjs`:

- Move `app/api` → `app/__api_excluded__`
- Move `middleware.ts` → `middleware.__excluded__.ts`
- Strip the `withSerwist` wrapper from `next.config.mjs` (service worker is meaningless in a Tauri webview)
- Set `output: 'export'`, `images.unoptimized: true`
- Run `next build`
- Restore everything via `try { … } finally { … }`

Wire into `package.json`:

```json
"build:tauri": "node scripts/prepare-tauri-build.mjs"
```

This script is already referenced by `src-tauri/tauri.conf.json#beforeBuildCommand`. The current placeholder (`next build`) will fail; replacing it is the first concrete task.

### Acceptance

- `pnpm build` (SaaS) succeeds, `app/api/*` reachable, middleware applied
- `pnpm build:tauri` succeeds, produces `out/` with no `/api/*` references
- Working tree is clean after both succeed and after a crashed build

---

## Phase 1 — Read-only browsing (tracer slice)

**Smallest useful desktop app**: open a Postgres, browse tables, view rows. No edits, no DDL, no imports.

### Endpoints to port

| Web route | Tauri command | Rust module |
| --- | --- | --- |
| `POST /api/connect` | `db_connect` (already drafted) | `postgres::connect` |
| `POST /api/disconnect` | `db_disconnect` (already drafted) | (drop from `DashMap`) |
| `GET /api/tables` | `db_list_tables` | `postgres::introspect::tables` |
| `GET /api/schemas` | `db_list_schemas` | `postgres::introspect::schemas` |
| `POST /api/table` | `db_table_rows` | `postgres::query_table` |
| `GET /api/health` | `db_health` | `postgres::health` |

### UI changes

- **Dispatcher at the existing `lib/api.ts` choke point** — turned out the SaaS already centralizes all HTTP through `lib/api.ts`. We gated `request()` on `window.__TAURI_INTERNALS__` and delegate to a new `lib/api-tauri.ts` dispatcher when in the desktop runtime. No call sites changed.
- **`lib/api-tauri.ts`** owns the route → command translation. Static routes (e.g. `POST /api/connect`) and parametric ones (e.g. `GET /api/table/<name>`, `GET /api/schema/<name>`) are dispatched to `invoke()`. Session id is held in module memory — the SaaS stores it in an httpOnly cookie, which doesn't apply on desktop.
- **Stub strategy for partial phase coverage** — the dashboard fires ~10 mount-time reads; throwing for every unimplemented one floods the dev overlay. Stubs return typed empty defaults (`{ views: [] }`, `{ counts: {} }`, …) so the UI stays quiet without faking data. Writes still throw to keep the gap visible. Each stub logs once with its phase so the work surface is searchable.
- **Strip rate-limit + CSRF checks in desktop mode** — they're meaningless when the server is local and there's only one user.

### Rust additions

- `src-tauri/src/postgres/introspect.rs` — `pg_catalog`-based queries for tables, schemas, columns
- `src-tauri/src/postgres/query.rs` — extend the existing `query` to accept `LIMIT/OFFSET` for paginated table viewing
- Trait abstraction `DbProvider` ahead of Phase 2 multi-database work (sketch interface only)

### Acceptance

In the desktop window: connect to a real Postgres, click a table in the schema sidebar, see rows paginate. Disconnect. No mutations possible (UI hides write buttons in desktop mode, or they 404 if reached).

---

## Phase 2 — Mutations + edit flow

Bring desktop to parity with the SaaS for the most common write workflow: inline editing, FK navigation, staged edits.

### Endpoints to port

| Web route | Tauri command |
| --- | --- |
| `POST /api/mutate` | `db_mutate` |
| `POST /api/mutate-batch` | `db_mutate_batch` |
| `POST /api/lookup-row` | `db_lookup_row` |

### Rust port of the safety classifier

The current TypeScript `lib/query-classifier.ts` does keyword-level classification and bulk-write detection. Port it to Rust **verbatim** — same READ/WRITE/DDL/BLOCKED keyword sets, same CTE-embedded-write detection, same typed-confirmation rules for `DROP`/`TRUNCATE`/bareword `UPDATE`/`DELETE`. The Rust side returns the same classification struct the UI already knows how to handle. No UX regression.

### Cross-cutting

- The web version's typed-confirmation handshake (server returns `needsConfirmation: true`, client re-posts with `confirmed: true`) should be **kept** in the Rust commands. It's UX scaffolding, not a security boundary — the only check that matters is the user typing the verb. But preserving the handshake means `lib/api-client.ts` can hide the fetch/invoke difference entirely.

### Acceptance

Edit a row, commit, roll back. Run a bareword `UPDATE foo SET x = 1` — UI demands the user type `UPDATE` to proceed. Run `DROP TABLE foo` — same. Bulk mutation works.

---

## Phase 3 — DDL + schema explorer

The schema explorer is read-heavy but Rust-deep — every `pg_catalog` query has to be ported.

### Endpoints to port

| Web route | Tauri command |
| --- | --- |
| `POST /api/ddl` | `db_ddl` |
| `GET /api/schema`, `/api/schemas`, `/api/schema-map`, `/api/schema-overview` | `db_schema_*` family |
| `GET /api/relationships` | `db_relationships` |
| `POST /api/cascade-preview` | `db_cascade_preview` |

### Notes

- The current TS schema introspection uses inline SQL. Port the SQL strings byte-for-byte where possible — they're already battle-tested.
- `cascade-preview` is the only one that needs careful design — it runs a query inside a savepoint, then rolls back. Verify `tokio-postgres`'s `simple_query` + transaction semantics match what the TS version expects.

---

## Phase 4 — Explain + perf + extras

Mechanical ports. Each is a single SQL invocation wrapped in error handling. No design risk.

| Web route | Tauri command |
| --- | --- |
| `POST /api/explain` | `db_explain` |
| `GET /api/performance` | `db_performance` |
| `GET /api/functions`, `/api/views` | `db_functions`, `db_views` |
| `GET /api/table-counts`, `/api/table-stats` | `db_table_counts`, `db_table_stats` |

---

## Phase 5 — Import / export / saved connections

### Filesystem-touching endpoints

| Web route | Tauri command | Notes |
| --- | --- | --- |
| `POST /api/import` | `db_import` | Web reads from request body; desktop reads from a real path via Tauri's `dialog` plugin. Simpler UX (native open dialog) but different code shape. |
| `POST /api/upload-sqlite` | `db_open_sqlite` | Same — native file picker. |

### Saved connections → OS keychain

The web version encrypts a list of `{id, name, config}` objects in a cookie. Desktop should use the OS keychain via `tauri-plugin-keyring`:

- macOS — Keychain
- Windows — Credential Manager
- Linux — Secret Service (gnome-keyring / KWallet)

Each saved connection becomes one keychain entry keyed by `id`. The user-visible list (names, ids, last-used timestamps — but **not** passwords) can live in `tauri-plugin-store` or a small SQLite file in the app's data dir.

### Acceptance

- Save a connection; verify it's in the OS keychain (Keychain Access on Mac, `secret-tool` on Linux, Credential Manager on Windows)
- Quit the app, reopen, connection appears in the saved list with the password auto-filled
- Delete a saved connection — keychain entry is removed

---

## Phase 6 — Polish + ship

### Code signing

| Platform | Cost | Friction without it |
| --- | --- | --- |
| macOS | $99/year Apple Developer Program | Gatekeeper blocks unsigned apps; users must right-click → Open every time |
| Windows | $0 with SmartScreen pain, ~$200 for a basic OV signing cert | "Unknown publisher" warning |
| Linux | Free | None |

### Auto-update

Tauri Updater plugin. Host signed update manifests on a static endpoint (Vercel works fine for this since it's just a JSON + tarball). Use the existing Tauri-recommended GPG signing scheme.

### Bundle size

The current spike binary is ~10-15 MB stripped on Linux. Mac and Windows similar. Already much better than Electron's 100+ MB. Optional optimizations: `cargo-strip`, `panic = "abort"` in release, link-time optimization in `Cargo.toml`.

### Workspace split (deferred from Phase 0.5)

By Phase 6 the migration is real and the `app/api` rename trick is showing its limits. Time to actually split:

- `apps/saas` — current Next.js app with `/api`
- `apps/desktop` — Next.js UI without `/api`
- `packages/ui` — shared React components
- `packages/sql` — shared TS for query-classifier (the Rust side is its own port)
- `src-tauri` stays under `apps/desktop`

Turborepo or pnpm workspaces. Probably 1-2 days of grunt work; do it after Phase 5 ships.

---

## Cross-cutting concerns

### Postgres type coverage

The spike covers: `bool`, `int2/4/8`, `float4/8`, `text/varchar/bpchar/name`, `json/jsonb`, `uuid`, `timestamp/tz`, `date`, `numeric`. Unknown types degrade to string.

Not covered yet, needed for production:

- Arrays of any of the above (`_int4`, `_text`, etc.)
- `bytea` (binary — needs base64 string serialization)
- Intervals (`interval` — needs custom struct)
- Ranges (`int4range`, `tstzrange`, etc.)
- `hstore` (extension type — `Vec<(String, Option<String>)>`)
- Custom enums (return as their string label)
- Geometric types (`point`, `lseg`, `box`, `path`, `polygon`, `circle` — display as string)

Plan: extend `postgres::row_to_json` incrementally as we hit users with those types. Don't pre-build all of them.

### Multi-database support

Current spike is pg-only. MySQL and SQLite need their own modules:

- `src-tauri/src/mysql.rs` — `sqlx-mysql` or `mysql_async`
- `src-tauri/src/sqlite.rs` — `rusqlite` (sync, but fine — single user, no contention)
- Trait `DbProvider` with `connect`, `query`, `mutate`, `introspect_*` — Rust enum dispatches per session

Defer the trait formalization until Phase 3 (when introspection diverges enough that the abstraction earns its keep).

### Connection lifecycle

The spike uses a `DashMap<String, Arc<PgConnection>>` keyed by session_id. For desktop, sessions are almost vestigial — there's one user, usually one active connection. Justifications for keeping sessions:

- Multiple windows / multiple connections in one window
- Cleanup on disconnect is explicit
- Same shape as the web version for code-sharing

Justifications for removing them:

- Simpler
- One less moving piece

Keep for now; revisit if it adds friction.

**Phase 1 update**: the spike wrapped `tokio_postgres::Client` in a `Mutex<Client>` for "safety." This was wrong on two counts: tokio-postgres `Client` is `Sync` and *designed* for concurrent queries (it pipelines internally), and a future holding the mutex while cancelled mid-query leaves the connection in a corrupt state — manifests as "connection closed" errors on every subsequent query. We replaced it with `Mutex<Arc<Client>>` (lock only to clone the Arc out, or swap on reconnect), plus a `force_reconnect()` path that retries once when a query returns a connection-closed error. The retry handles transient drops (Neon pooler, idle timeouts) without surfacing them to the user. See decision log.

### TLS verification

The spike hard-codes `danger_accept_invalid_certs(true)` when SSL is on, matching the current web behavior. This is wrong for production. Plan:

- Default: full cert verification
- UI checkbox: "Trust self-signed certificate" — opt-in per connection
- Persist the choice with the saved connection

Do this during Phase 1 — it's a 20-line change and the right default matters more for desktop than for SaaS (because users are connecting to *their* production DBs, not playground ones).

### Sessions / rate limiting / CSRF in desktop mode

All vestigial. Strip them when porting each endpoint. Document in code why they're gone (one comment per stripped piece, max).

---

## Open questions

These need answers before or during Phase 1. Don't block on them now, but flag them:

1. **WebView2 on Windows 10** — defaults present from 1809 update onward, but if a user is on stock Windows 10 we may need to bundle the evergreen runtime. Decision: detect at install time and prompt.
2. **Saved connections format migration** — users of the SaaS already have encrypted-cookie saved connections. Desktop won't share that storage. Does the first desktop launch offer to import from a SaaS cookie export? Probably not for v1; document as a known gap.
3. **Mobile track** — the existing mobile-first UI is the SaaS differentiator. Tauri 2 supports iOS/Android. Worth a separate spike *after* desktop is shipped to see if the Rust postgres path makes sense on mobile, or if mobile stays SaaS-only.
4. **Multi-tab inside one window** — does each tab get its own session, or share one? Affects connection store shape. Default to one session per tab.
5. **Query timeout enforcement** — web version has 30s timeout in `executeQuery`. Need equivalent in Rust via `tokio::time::timeout` wrapping `client.query`. Phase 1.

---

## Decision log

Tracking choices made during the spike that should outlive it:

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-05-22 | Pure Rust backend, not Node sidecar | Trust story; smaller binary; native TCP without bundling Node |
| 2026-05-22 | Tauri 2, not Electron | 10× smaller binary, capability-based security, OS-native webview |
| 2026-05-22 | Dedicated dev port 3030 | User runs multiple Next.js apps locally; 3000/3001 are usually taken |
| 2026-05-22 | WebKit/WSL env vars baked into `tauri:dev` script | WSLg + WebKitGTK is fragile; baking the workarounds means devs don't have to remember them. No-op on macOS/Windows. |
| 2026-05-22 | Spike validated without final visual confirmation on Windows | Architecture pieces all proven; final confirmation gated only on installing MSVC Build Tools on a Windows machine, which is one-time setup separate from architectural risk. |
| 2026-05-23 | Dispatcher lives in `lib/api-tauri.ts`, gated from existing `lib/api.ts` | The SaaS already centralized HTTP through `lib/api.ts`; gating there means zero call-site churn. New file isolates the Tauri-only deps from the SaaS bundle. |
| 2026-05-23 | Removed `Mutex<Client>`; added `force_reconnect()` retry on connection-closed | `Mutex<Client>` serialized concurrent dashboard queries and could corrupt the connection on future-cancellation. tokio-postgres `Client` is `Sync` by design. Reconnect-on-closed absorbs transient Neon/pooler drops without bubbling to the UI. |
| 2026-05-23 | Stub unimplemented mount-time reads with typed empty defaults | The dashboard fires ~10 reads on mount; throwing for unwired routes flooded the dev overlay during Phase 1. Stubs return shape-compatible empties (`{ views: [] }` etc.) so the UI is quiet but never *fake* — write paths still throw so the gap is visible. Each stub logs once with its phase. |

---

## How to use this doc

- Open one phase, scope a sprint to it, ship.
- Update the decision log when you make a non-obvious choice.
- When a phase is done, mark it ✅ in the overview table and link to the merge commit.
- When a cross-cutting concern gets resolved, move it from "Cross-cutting concerns" to the decision log.
- This doc lives next to the code on purpose. If it's wrong, fix it in the same PR as the thing that made it wrong.
