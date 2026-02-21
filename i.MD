# DBView — Production Readiness Plan

## Context

DBView is a brutalist database explorer (Next.js 14, React 18, TypeScript, Tailwind CSS) that currently works as a **read-only PostgreSQL browser** with a SQL query editor. It has solid foundations: AES-256 encryption, query validation, rate limiting, security headers, dark mode, 6 color palettes, CodeMirror SQL editor, EXPLAIN plans, multi-schema support, and responsive design.

To make it worth using for everyday developers (not just a portfolio piece), it needs: data editing, connection URL parsing, multi-database support, keyboard shortcuts, deployment tooling, and power-user features.

**Previous plan phases (1-4) are COMPLETE.** This is the new plan.

---

## Phase 1: "Actually Useful" — Daily Driver Features

> Status: **COMPLETE**
> Goal: Make DBView worth opening over pgAdmin/TablePlus for quick tasks.

### 1A. Connection URL Parsing
Paste `postgresql://user:pass@host:5432/db` instead of filling 5 fields.

**New files:**
- `lib/connection-url.ts` — `parseConnectionURL()`, `isConnectionURL()`, `detectDatabaseType()`

**Modify:**
- `app/components/connection-form.tsx` — Add URL/Fields toggle mode, auto-populate fields from URL
- `app/api/connect/route.ts` — Accept optional `connectionUrl` field

### 1B. Inline Cell Editing (INSERT/UPDATE/DELETE)
Double-click a cell to edit. Add/delete rows. Confirmation modal shows generated SQL before executing.

**New files:**
- `lib/mutation.ts` — Parameterized query builders: `buildUpdateQuery()`, `buildInsertQuery()`, `buildDeleteQuery()`, `validateIdentifier()`
- `app/api/mutate/route.ts` — Mutation endpoint (bypasses `validateQuery()`, uses safe query builder). Checks `DBVIEW_READ_ONLY` env var.
- `app/components/editable-cell.tsx` — Inline cell editor (input/textarea based on data type)
- `app/components/row-editor.tsx` — Add new row form
- `app/components/mutation-confirmation.tsx` — Modal showing generated SQL before execution

**Modify:**
- `app/components/data-table.tsx` — Double-click-to-edit, delete button on row hover, "ADD ROW" button. Requires primary key info to build WHERE clauses. Tables without PK show editing as disabled.
- `app/components/dashboard.tsx` — Pass schema metadata to DataTable, add mutation handlers
- `app/contexts/dashboard-context.tsx` — Add mutation functions, `refreshTableData()`, `readOnlyMode` state
- `lib/rate-limiter.ts` — Add rate limit for `/api/mutate` (20/min)

### 1C. Keyboard Shortcuts
Global shortcut system with help overlay.

**New files:**
- `app/hooks/use-keyboard-shortcuts.ts` — Central registry, event handler, skips inputs/CodeMirror
- `app/components/keyboard-shortcuts-help.tsx` — Overlay listing all shortcuts by category

**Shortcuts:**
| Key | Action |
|-----|--------|
| `Cmd+K` | Focus table search |
| `Cmd+J` | Toggle sidebar |
| `Cmd+/` | Show shortcuts help |
| `Cmd+Shift+Q` | Go to query page |
| `Cmd+Shift+T` | Go to tables page |
| `Cmd+N` | Add new row |
| `Escape` | Close modal/cancel edit |

**Modify:**
- `app/components/dashboard.tsx` — Register navigation/table shortcuts
- `app/components/query-editor.tsx` — Register query shortcuts
- `app/components/header.tsx` — Add keyboard icon to open shortcuts help

### 1D. Query Formatting
One-click SQL prettify.

**New dependency:** `sql-formatter`

**New file:**
- `lib/sql-formatter.ts` — Wraps `sql-formatter` with brutalist defaults (uppercase keywords, 2-space indent)

**Modify:**
- `app/components/query-editor.tsx` — Add "FORMAT" button

### 1E. Table Statistics
Show table size, row counts, index usage, vacuum info when a table is selected.

**New files:**
- `app/api/table-stats/[name]/route.ts` — Returns stats from `pg_class`, `pg_stat_user_tables`
- `app/components/table-stats.tsx` — Compact stats bar: total size, index size, est. rows, seq/idx scans, last vacuum

**Modify:**
- `lib/db.ts` — Add `getTableStats()` function
- `app/contexts/dashboard-context.tsx` — Add `tableStats` state, load on table select
- `types/index.ts` — Add `TableStats` interface

### Phase 1 Verification
- [ ] `npm run build` — no errors
- [ ] Paste a connection URL → fields auto-populate → connect works
- [ ] Double-click cell → edit → confirm → data updates in DB
- [ ] Add row → confirm → row appears
- [ ] Delete row → confirm → row removed
- [ ] `Cmd+/` opens shortcuts overlay
- [ ] FORMAT button prettifies SQL
- [ ] Table stats show when table is selected
- [ ] Tables without primary key show editing disabled with explanation

---

## Phase 2: "Clean UI" — Modern Design System

> Status: **NOT STARTED**
> Goal: Replace the brutalist design with a clean, functional UI suited for data-heavy work.

The brutalist aesthetic (2px borders, all-caps text, monospace everywhere, box shadows) prioritizes style over usability. For a database tool where you stare at tables of data, scan column names, and read query results, the UI needs to get out of the way. This phase replaces it with a modern, minimal design inspired by tools like TablePlus, Supabase Studio, and pgAdmin 4.

### 2A. Design Token Overhaul
Replace brutalist CSS variables and Tailwind config with a clean design system.

**Modify:**
- `app/globals.css` — Replace brutalist base styles:
  - Remove `* { @apply font-mono }` (only code/data should be monospace)
  - Remove `h1-h6 { @apply font-bold uppercase }` (headings should be sentence-case)
  - Add Inter/system font stack as default body font
  - Add proper color tokens: `--bg`, `--bg-secondary`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--danger`, `--success`, `--warning`
  - Light mode: soft grays (#f9fafb backgrounds, #e5e7eb borders, #111827 text)
  - Dark mode: dark grays (#0f1117 backgrounds, #1f2937 borders, #f9fafb text)

- `tailwind.config.ts` — Replace brutalist extensions:
  - Remove `boxShadow.brutal*`
  - Remove `white`/`black` color overrides (restore Tailwind defaults)
  - Add `fontFamily.sans` (Inter, system-ui stack)
  - Keep `fontFamily.mono` for code/data
  - Add `borderRadius` tokens (sm: 4px, md: 6px, lg: 8px)
  - Add subtle shadow tokens (`shadow-sm`, `shadow-md`)

### 2B. UI Primitives
Restyle the base components from brutalist to clean.

**Modify:**
- `app/components/ui/button.tsx` — Rounded corners, subtle hover states, no box shadows. Variants: `primary` (filled accent), `secondary` (outlined), `ghost` (text only), `danger` (red).
- `app/components/ui/input.tsx` — Rounded, light border, focus ring instead of brutalist focus shadow. Proper placeholder styling.
- `app/components/ui/modal.tsx` — Backdrop blur, rounded card, smooth fade-in. Drop the heavy black border.
- `app/components/ui/card.tsx` — Light border, subtle shadow, rounded corners.
- `app/components/ui/badge.tsx` — Pill shape, muted backgrounds, no heavy borders.
- `app/components/ui/toast.tsx` — Rounded, slide-in animation, icon per type.
- `app/components/ui/spinner.tsx` — Ensure it fits the new aesthetic.
- `app/components/ui/skeleton.tsx` — Subtle pulse animation, rounded.
- `app/components/ui/confirm-dialog.tsx` — Consistent with new modal style.

### 2C. Layout Components
Clean up the structural chrome.

**Modify:**
- `app/components/header.tsx` — Slim horizontal bar, no heavy borders. Database name in normal case. Clean icon buttons.
- `app/components/sidebar.tsx` — Light background, subtle separator from main content, hover highlights instead of heavy selection borders. Tree-style indentation for schemas/tables/views.
- `app/components/footer.tsx` — Minimal, muted text.
- `app/components/resizable-splitter.tsx` — Thin drag handle, subtle hover indicator.
- `app/components/main-content.tsx` — Clean padding, no heavy borders.
- `app/components/mobile-menu.tsx` — Slide-in drawer with backdrop.
- `app/components/breadcrumb.tsx` — Normal case, subtle separators, no heavy styling.

### 2D. Data Display Components
The most impactful changes — these are what users stare at.

**Modify:**
- `app/components/data-table.tsx` — Thin borders or border-bottom only. Alternating row backgrounds. Compact row height. Sticky header. Monospace only for data cells, not headers. Remove all-caps from headers.
- `app/components/table-schema.tsx` — Clean collapsible card. Normal-case headers. Subtle PK badge.
- `app/components/table-stats.tsx` — Subtle stat chips or inline metrics. No heavy border box.
- `app/components/relationship-display.tsx` — Clean expandable sections. Subtle FK/index badges.
- `app/components/pagination.tsx` — Clean page buttons, muted info text.
- `app/components/column-visibility.tsx` — Clean dropdown/popover with checkboxes.
- `app/components/export-dropdown.tsx` — Clean dropdown menu.
- `app/components/table-list.tsx` — Clean list with hover states, active indicator.
- `app/components/empty-state.tsx` — Centered, muted, with icon.
- `app/components/error-state.tsx` — Red accent, clean retry button.

### 2E. Feature Components
Update the Phase 1 feature UIs.

**Modify:**
- `app/components/connection-form.tsx` — Clean form layout. Card-based. Proper field labels.
- `app/components/connection-selector.tsx` — Clean tabs or segmented control.
- `app/components/saved-connections.tsx` — Clean list with edit/delete actions.
- `app/components/editable-cell.tsx` — Clean inline input, subtle edit indicator.
- `app/components/row-editor.tsx` — Clean form in modal.
- `app/components/mutation-confirmation.tsx` — Clean confirmation dialog with syntax-highlighted SQL.
- `app/components/keyboard-shortcuts-help.tsx` — Clean overlay with grouped shortcuts. Kbd-style key badges.
- `app/components/query-editor.tsx` — Clean toolbar, subtle button styling.
- `app/components/sql-editor.tsx` — Ensure CodeMirror theme aligns with new palette.
- `app/components/query-history.tsx` — Clean list with timestamps.
- `app/components/explain-plan.tsx` — Clean tree display.
- `app/components/theme-toggle.tsx` — Clean icon toggle.
- `app/components/connection-status.tsx` — Subtle status indicator.

### 2F. Skeleton & Loading States
**Modify:**
- `app/components/skeletons/table-skeleton.tsx` — Match new table styling.
- `app/components/skeletons/sidebar-skeleton.tsx` — Match new sidebar styling.

### Implementation Strategy
1. Start with `globals.css` + `tailwind.config.ts` (design tokens) — this immediately shifts the base look.
2. Restyle UI primitives (`button`, `input`, `modal`, `card`, `badge`, `toast`) — these cascade everywhere.
3. Update layout components (`header`, `sidebar`, `footer`, `splitter`) — the app frame.
4. Update data display components (`data-table`, `table-schema`, `pagination`) — the core experience.
5. Update feature components and skeletons — finishing touches.

### Phase 2 Verification
- [ ] `pnpm run build` — no errors
- [ ] Light mode looks clean with proper grays, rounded corners, readable text
- [ ] Dark mode has proper contrast, no brutalist artifacts
- [ ] Data table is readable with proper row density
- [ ] All modals/dialogs use new style (no heavy borders)
- [ ] All text is sentence-case (no unnecessary ALLCAPS)
- [ ] Monospace font only used for data cells, SQL, and code
- [ ] All Phase 1 features still function correctly

---

## Phase 3: "Team Ready" — Deployment & Auth

> Status: **NOT STARTED**
> Goal: Make DBView deployable for teams with a single `docker-compose up`.

### 3A. Docker Support

**New files:**
- `Dockerfile` — Multi-stage build (node:20-alpine builder + runner), Next.js standalone output
- `docker-compose.yml` — Service with env vars: `ENCRYPTION_KEY`, `DATABASE_URL`, `DBVIEW_AUTH_ENABLED`, `DBVIEW_READ_ONLY`
- `.dockerignore` — Exclude node_modules, .next, .git

**Modify:**
- `next.config.js` (create if needed) — Add `output: 'standalone'`

### 3B. Environment-Based Connection
Auto-connect from `DATABASE_URL` env var on startup.

**Modify:**
- `app/api/connect/route.ts` — Check `DATABASE_URL` on first request
- `lib/db/index.ts` — Add `connectFromEnv()` using `parseConnectionURL()`
- `app/contexts/connection-context.tsx` — Check server for pre-configured connection on mount

### 3C. Basic Authentication

**New dependency:** `bcryptjs`

**New files:**
- `lib/auth.ts` — Session validation, bcrypt password check
- `app/api/auth/login/route.ts` — Login endpoint
- `app/login/page.tsx` — Brutalist login page

**Modify:**
- `middleware.ts` — Check `auth-session` cookie when `DBVIEW_AUTH_ENABLED=true`

Env vars: `DBVIEW_AUTH_ENABLED`, `DBVIEW_USERNAME`, `DBVIEW_PASSWORD_HASH`

### 3D. Audit Logging

**New files:**
- `lib/audit-log.ts` — Circular buffer (1000 entries) + stdout logging. Logs: timestamp, user, action, query, execution time, row count.
- `app/api/audit/route.ts` — GET recent audit entries

**Modify:**
- `app/api/query/route.ts` — Log after query execution
- `app/api/mutate/route.ts` — Log after mutation

### 3E. Read-Only Mode
Already wired in Phase 1B's `/api/mutate` route via `DBVIEW_READ_ONLY` env var.

**Modify:**
- `app/api/health/route.ts` — Return `readOnlyMode` flag
- `app/components/dashboard.tsx` — Hide edit/insert/delete UI when read-only

### Phase 3 Verification
- [ ] `docker build` succeeds
- [ ] `docker-compose up` with `DATABASE_URL` auto-connects
- [ ] Auth login page appears when `DBVIEW_AUTH_ENABLED=true`
- [ ] Audit log records queries and mutations
- [ ] `DBVIEW_READ_ONLY=true` hides all editing UI

---

## Phase 4: "Power User" — Advanced Features

> Status: **NOT STARTED**
> Goal: Features that make daily drivers switch permanently.

### 4A. Saved Queries/Workspaces

**New files:**
- `app/hooks/use-saved-queries.ts` — localStorage-backed saved queries with tags
- `app/components/saved-queries.tsx` — Saved queries panel with search and tags

**Modify:**
- `app/components/query-editor.tsx` — Add "SAVE" button and saved queries sidebar
- `types/index.ts` — Add `SavedQuery` interface

### 4B. ER Diagram Visualization
SVG-based entity-relationship diagram for the current schema.

**New files:**
- `app/components/er-diagram.tsx` — SVG renderer with tables as boxes, FK lines between them
- `lib/er-layout.ts` — Simple force-directed or grid layout algorithm
- `app/api/relationships/route.ts` — All relationships for all tables in a schema

**Modify:**
- `app/components/header.tsx` — Add "ER DIAGRAM" nav button

### 4C. Data Import from CSV

**New dependency:** `papaparse`

**New files:**
- `app/api/import/route.ts` — Accepts CSV, parses, inserts into table
- `app/components/csv-import.tsx` — File upload with column mapping

### 4D. Table Creation Wizard

**New files:**
- `app/components/table-wizard.tsx` — Step-by-step form: table name, columns (name, type, nullable, default, PK), constraints
- `app/api/ddl/route.ts` — Executes CREATE TABLE
- `lib/ddl-builder.ts` — Builds CREATE TABLE SQL from wizard input (dialect-aware)

### 4E. Schema-Aware Auto-Complete
Use actual table/column names in CodeMirror auto-completion.

**Modify:**
- `app/components/sql-editor.tsx` — Pass `schema` option to CodeMirror's `sql()` extension with real table/column data
- `app/contexts/dashboard-context.tsx` — Cache table/column names for auto-completion

### Phase 4 Verification
- [ ] Save a query → appears in saved queries panel → click to load
- [ ] ER diagram shows all tables with FK connections
- [ ] Import CSV into a table → data appears
- [ ] Create a table via wizard → table appears in sidebar
- [ ] Auto-complete suggests real table/column names

---

## Phase 5: "Polish & Scale" — Production Grade

> Status: **NOT STARTED**
> Goal: Final polish for a production-quality tool.

### 5A. Query Result Diffing
Side-by-side comparison of two query results.

**New file:**
- `app/components/result-diff.tsx` — Row-by-row diff with highlighted changes

### 5B. Batch Export
Export multiple tables at once as a ZIP file.

**New dependency:** `archiver`

**New files:**
- `app/api/export/batch/route.ts` — Accepts table names, streams ZIP of CSV/JSON
- `app/components/batch-export.tsx` — Table selection UI

### 5C. Performance Monitoring Dashboard
Active queries, slow query log, connection pool usage, table bloat.

**New file:**
- `app/components/performance-dashboard.tsx` — Uses `pg_stat_activity`, `pg_stat_user_tables`, `pg_stat_bgwriter`

### 5D. Plugin/Extension System
Allow custom query templates and data transformations.

**New files:**
- `lib/plugin-system.ts` — Plugin registry with lifecycle hooks
- `lib/plugins/` — Directory for built-in plugins

### Phase 5 Verification
- [ ] Diff two query results → changes highlighted
- [ ] Batch export 3 tables → downloads ZIP
- [ ] Performance dashboard shows live stats
- [ ] Plugin loads and executes

---

## Dependencies Summary

| Phase | Package | Purpose |
|-------|---------|---------|
| 1 | `sql-formatter` | SQL prettifying |
| 2 | `mysql2` | MySQL database driver |
| 3 | `bcryptjs` | Password hashing for auth |
| 4 | `papaparse` | CSV parsing for import |
| 5 | `archiver` | ZIP file creation for batch export |

## Key Files (Most Modified Across Phases)

- `lib/db.ts` → `lib/db/postgresql.ts` — Database operations (decomposed in Phase 2)
- `app/components/data-table.tsx` — Gains editing in Phase 1B
- `app/components/connection-form.tsx` — URL parsing (1A), DB type selector (2D)
- `app/contexts/dashboard-context.tsx` — Mutations (1B), stats (1E), auto-complete (4E)
- `types/index.ts` — Grows with every phase
- `middleware.ts` — Auth check (3C)
- All 14 API routes — Provider pattern migration (Phase 2)
