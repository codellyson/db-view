# JustDB — UX Improvements

A prioritized backlog of UX fixes and feature work to make JustDB feel as good to use as DBeaver, with the polish of a modern web tool. Organized by impact, not by area, so you can work top-down and ship value fast.

---

## P0. The heart of the tool

These are the features that determine whether power users (you included) actually enjoy using JustDB. Nail these before anything else. If you only build the P0 list, you've built something genuinely good.

### 1. Inline cell editing

Double-click any cell in the result/table grid to edit it in place. No modal, no side panel.

- `Tab` moves to the next cell, `Shift+Tab` moves back, `Enter` moves down, `Escape` cancels.
- Editor should be type-aware:
  - Dates: date/datetime picker.
  - Booleans: toggle or dropdown.
  - Enums: dropdown of allowed values.
  - JSONB / JSON: expandable textarea with syntax highlighting.
  - Long text / `character varying`: textarea that auto-grows.
  - UUID: plain text but with a "generate new" button.
- `NULL` should be distinct from empty string. Add a "Set NULL" affordance (right-click menu or a small `∅` button in the editor).

### 2. Staged changes with SQL preview

Edits do NOT hit the database immediately. They are staged.

- Changed cells get a visible state (suggested: amber/orange tint).
- New rows: green tint. Deleted rows: red tint with strikethrough.
- A floating action bar appears at the bottom when there are pending changes:
  `3 changes pending  [Discard]  [Review SQL]  [Save]`
- "Review SQL" opens a modal showing the generated `UPDATE` / `INSERT` / `DELETE` statements before commit. This is the trust-building feature. Users feel safe because they see exactly what will run.
- "Discard" reverts everything. "Save" commits in a transaction (rollback on failure).
- `Ctrl/Cmd+S` triggers the same Review SQL flow.
- `Ctrl/Cmd+Z` reverts a single staged cell edit.

### 2.5. Cascade impact in Review SQL

When the staged changes include any `DELETE`, the Review SQL modal shows a "Cascade impact" panel above the SQL list. This is the safety net that makes cascading deletes feel safe — you see what is about to vanish before you commit.

- **Per-table breakdown**: each child table affected by the cascade graph, with row count and rule. Example: `orders` — 12 rows (CASCADE), `audit_log` — 84 rows (CASCADE), `customers` — 3 rows (SET NULL on `last_order_id`).
- **Expand to inspect**: click any child-table row to lazy-load up to 100 sample rows, rendered with the same cell-display components as the main grid.
- **Blocking FKs**: if any `RESTRICT` or `NO ACTION` constraint has dependent rows, render a red banner — "Cannot delete: 4 rows in `invoices` reference this row." — and disable Save until the user unstages or resolves.
- **Threshold confirmation**: if the total cascaded row count is at or above 100 (configurable per connection), require typed confirmation matching the parent table name. Same pattern as #25.
- **Truncation hint**: traversal has a time budget and depth cap. When hit, show "Showing first N — actual cascade may be larger" with a "Refine" button that re-runs with higher limits.
- **SQLite caveat**: if `PRAGMA foreign_keys = OFF`, show a warning that cascade preview is best-effort in this state, since the database itself will not enforce FK rules at delete time.

Optionally, a stage-time badge: when a row is staged for delete, show `+N rows` next to it (cheap pre-check skips this when the parent table has no incoming FKs). Skippable for v1.

The cascade graph is built from reverse-FK introspection — the same data that powers #7 in the "referenced by" direction. Preview runs on a dedicated read-only endpoint; no mutations are issued during preview.

### 3. Inline new row creation

Replace the modal-style "+ Add row" with a permanent empty row at the top or bottom of the grid.

- Click any cell in it, start typing. It becomes a pending insert (green tint).
- The "+ Add row" button can stay, but it should just focus the empty row, not open a modal.
- Multiple new rows in a row should be fine. Tab past the last cell of the empty row to spawn another empty row below.

### 4. Highlight-to-run in the SQL editor

In the SQL editor, `Ctrl/Cmd+Enter` should:

- If text is selected: run only the selected SQL.
- If nothing selected: run the statement at the cursor position (split by semicolons).
- If the editor contains only one statement: run it.

This is one of the biggest reasons DBeaver feels great. Cheap to build, massive payoff.

### 5. Per-query result panels

When the editor has multiple queries and the user runs more than one, results should not clobber each other.

- Each run query gets its own result tab/section in the results pane.
- Tabs are labeled with a snippet of the query (e.g., `select * from "Pages"...`).
- Results persist until the user closes them or runs the same query again.
- Last-run query's results are focused by default.

---

## P1. Usability fixes that hurt you today

These are things that will visibly bug users (and you) within the first 5 minutes of using the app at real scale.

### 6. Schema sidebar at scale

192 tables is the reality. The current sidebar is a flat list with substring search. Improve to:

- **Pinned tables** at the top: right-click a table → "Pin to top." Persist per-connection.
- **Recently viewed**: a small section above the full list showing last 5–10 opened.
- **Grouping by prefix**: auto-detect prefixes like `CommerceAgent*`, `Course*`, `Creator*` and offer a "Group by prefix" toggle. Collapsible groups.
- **Fuzzy search**: typing `addr` should match `Addresses`, `OrderAddresses`, `address_book`, etc. Use something like fuse.js or a simple subsequence matcher.
- **Keyboard jump**: `Cmd/Ctrl+P` opens a command-palette-style table picker (full screen overlay, fuzzy search, arrow keys, Enter to open). This is the single most-loved shortcut among devs. Don't skip it.
- Show row count next to each table name (when cheap to compute, or fetched lazily).

### 7. Foreign key navigation (your differentiator)

This is the one feature that would set JustDB apart. Almost no tool nails it.

- Detect FK columns from the schema (`customer_id`, `product_subscription_id`, etc.).
- Render FK values as clickable hyperlinks (different color, underline on hover).
- Clicking opens the related row in a side panel (slide in from the right). The panel shows the full row with all its FKs also clickable.
- Optionally: a "open in new tab" button on the side panel header.
- Bonus: a small icon next to the column header indicating "this is a FK to `Customers.id`."

### 8. Tab management

The current tab bar will break with 8+ tabs (already happening in your screenshots).

- **Overflow menu**: when tabs don't fit, show a `…` button at the end with a dropdown of hidden tabs.
- **Drag to reorder**: standard.
- **Pin tabs**: right-click → "Pin." Pinned tabs are smaller (icon only) and stick to the left.
- **Deduplicate**: opening the same table twice should focus the existing tab, not create a duplicate. Two `SQL Editor 1` tabs should be auto-numbered (`SQL Editor 1`, `SQL Editor 2`).
- **Persist tabs across sessions**: when the user reconnects to the same DB, their last tab layout is restored. Web tools that lose state on refresh feel toy-like.
- **Middle-click to close** (and `Cmd/Ctrl+W`).

### 9. SQL editor visible state

The editor screen feels empty because it is. Fix:

- Show a placeholder result panel below the editor with text like "Run a query to see results here." This communicates the layout before any query runs.
- The icon rail on the left (Run, Run All, Format, Clear, History) needs tooltips on hover with shortcut hints (e.g., "Run query (⌘↵)").
- Consider replacing some icons with text+icon combos for the less obvious ones.

### 10. Row count and pagination clarity

The footer area is currently confusing. Add an explicit:

`Showing 1–50 of 12,483 rows · Filtered from 14,000 (3 filters)`

When the table is fully loaded: `12,483 rows`. When filtered: show both the visible and the total. When loading: show a skeleton or "Counting…"

### 11. Per-column filters

Search rows is fine for free-text but not for "show me all addresses where country = Nigeria AND state_code = 100101."

- Click the column header → "Filter" option in the menu.
- Filter chips appear above the grid: `country = Nigeria`  ×.
- Operators per type: equals, not equals, contains, starts with, IS NULL, IS NOT NULL, between (numeric/date), in (list).
- Multiple chips combine with AND. Optionally support OR groups later.
- The applied filter generates a SQL `WHERE` clause that is visible somewhere (transparency = trust).

### 12. Cell display polish

Several small fixes that add up:

- **UUIDs**: show as truncated (`2a46e2cb-df14…`) but with a copy-on-hover button. Click to copy full value.
- **Long text**: hover to show full value in a tooltip; click to expand inline (or open in side panel).
- **JSONB**: pretty-print on click. A small `{}` icon in the cell indicates JSON.
- **Booleans**: render as ✓ / ✗ or colored pills, not raw `true`/`false`.
- **Timestamps**: respect user's locale, but offer a "show raw ISO" toggle in column settings.
- **Images** (URLs in columns named `image`, `avatar`, etc.): optional thumbnail preview.
- **NULL**: keep the italic gray treatment. It's good.

### 13. Tooltips, labels, and disambiguation

- Every icon-only button gets a tooltip on hover.
- The `Columns` button in the toolbar: rename or relabel so it's clear what it does (toggle column visibility? add column? sort?).
- `Export` vs `Batch Export`: see P2 below.

---

## P2. Export, fixed

Export should be one feature with clear options, not two buttons that confuse users.

### 14. Single Export button with a proper modal

Click "Export" → modal opens:

- **Scope** (radio):
  - Current view (filtered + sorted): N rows
  - All rows in this table: M rows
  - Selected rows only: K rows (only if rows are selected)
- **Format** (dropdown): CSV, JSON, NDJSON, SQL INSERT, Excel (.xlsx), TSV.
- **Options** (checkboxes, format-dependent):
  - Include headers (CSV/TSV)
  - Use schema-qualified table name (SQL)
  - Pretty-print (JSON)
- **Destination**: download to browser (default). Future: "save to workspace" or "email me."
- **Remember my choice**: checkbox. Sets a sane default for next time.

For **really big exports** (>100k rows): show a progress bar with rows-exported counter. Stream the file rather than building it all in memory. If the browser tab closes, optionally resume on next open.

### 15. Batch Export becomes "Export Multiple Tables"

Move it under a different entry point (maybe in the schema sidebar's table list with multi-select via checkbox). Don't have it sit next to the per-table Export, that's the source of confusion.

---

## P3. Keyboard shortcuts (table-stakes for devs)

Document these in a `?` help overlay.

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+P` | Open table picker (jump to any table) |
| `Cmd/Ctrl+K` | Command palette (run any action) |
| `Cmd/Ctrl+Enter` | Run query (selection or current statement) |
| `Cmd/Ctrl+S` | Save pending changes (opens Review SQL) |
| `Cmd/Ctrl+Z` | Undo last cell edit |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `Cmd/Ctrl+W` | Close current tab |
| `Cmd/Ctrl+T` | New SQL editor tab |
| `Cmd/Ctrl+F` | Find in current result set |
| `Tab` / `Shift+Tab` | Next/prev cell when editing |
| `Enter` / `Esc` | Confirm/cancel cell edit |
| `?` | Show keyboard shortcut help |

---

## P4. Web-native advantages worth leaning into

Things native tools cannot do well. These are how you can leapfrog DBeaver and TablePlus, not just match them.

### 16. Shareable URL state

Every result panel, every filtered view, every query, has a URL. Pasting that URL into Slack opens the same view (assuming the recipient has access).

- URL encodes: connection, table, filters, sort, pagination, selected row.
- For SQL editor tabs: URL encodes the query text (or a hash that points to a saved query).

### 17. Saved queries and snippets

A "Saved" section in the left sidebar (above or below tables). Save any query with a name, description, and tags. Snippets can be parameterized (`:user_id`, `:start_date`).

### 18. Query history that actually works

The clock icon in the editor's left rail suggests history. Make sure it:

- Persists across sessions (per connection).
- Shows query, timestamp, duration, row count.
- Lets you re-run, edit, or save any past query.
- Is searchable.

### 19. Comments and collaboration (later)

Comments on queries (think Google Docs comments anchored to a line). Mentioning a teammate via `@`. Read-only share links for stakeholders. Don't build this on day one, but architect for it.

### 20. Connection latency / health indicator

The "Connected: railway" pill is currently redundant (you already see data). Replace with something useful:

- Latency (e.g., `42ms`).
- DB size or table count.
- Click to open connection details.

---

## P5. Polish and empty states

The little things.

### 21. Better empty and error states

- **Empty result**: "No rows match this query." With a suggestion: "Try removing filters" or "Check your WHERE clause."
- **Empty table**: "This table has no rows yet." With an "Add the first row" button.
- **Query error**: render the error inline, syntax-highlighted if it's a SQL error. Highlight the offending line. Offer "Ask AI to fix" if you ever go that route.
- **Connection lost**: clear banner with "Reconnect" button. Don't just silently fail.

### 22. Resizable panels

Let users drag the divider between schema sidebar and main pane, and between editor and results pane. Persist sizes.

### 23. Column reorder, resize, and saved layouts

Drag column headers to reorder. Drag column edges to resize. Save the layout per-table per-user so it persists.

### 24. Sticky headers and row numbers

When scrolling long tables, column headers stay pinned. Optional row number column on the far left.

### 25. Confirmation for destructive operations

- `DELETE` without `WHERE` → modal: "This will delete ALL rows in `Addresses`. Type the table name to confirm."
- `DROP TABLE` / `TRUNCATE` → same treatment.
- `UPDATE` without `WHERE` → same.

This is non-negotiable. One accidental `DELETE FROM addresses` and a user never trusts your tool again.

### 26. Bulk row operations

- Checkbox column on the left for multi-select.
- Shift+click to select range.
- Bulk actions toolbar appears: Delete, Duplicate, Export selected.

### 27. Query autocomplete

In the SQL editor:

- Table names after `FROM`, `JOIN`, `UPDATE`, `INTO`.
- Column names after `SELECT`, `WHERE`, `ON`, `SET`.
- SQL keywords with smart casing.
- Use the connected schema as the source of truth.

### 28. Performance: virtualized rows

For result sets >1000 rows, render only the visible rows (windowing). Otherwise the DOM dies. Use `react-virtual` or `tanstack-virtual`.

### 29. Footer cleanup

Move "Built by KreativeKorna Concepts" out of the persistent footer. Put it in an About modal or the Connections page. The footer real estate is too valuable for a credit line.

---

## Implementation order (suggested)

If you want a clear sequence:

1. **Week 1:** Inline cell editing (#1) + staged changes with SQL preview (#2) + inline new row (#3). This is the heart.
2. **Week 2:** Highlight-to-run (#4) + per-query result panels (#5) + keyboard shortcuts (#P3). The editor becomes a proper tool.
3. **Week 3:** FK navigation (#7) + Cmd+P table picker (#6) + per-column filters (#11). The differentiators.
4. **Week 4:** Export modal (#14) + cell display polish (#12) + tab management (#8) + row count clarity (#10). The polish pass.
5. **Later:** Web-native advantages (#16–19), empty states (#21), confirmations (#25), virtualization (#28), autocomplete (#27).

After Week 1, eat your own dogfood for a day. The friction will guide your priorities better than this list.

---

## A note on the mental model

The shift you're making is from "database as fragile thing accessed through forms" to "database as something you can touch directly, with safety nets underneath." Every decision should pass this test:

> Does this interaction feel like I'm directly manipulating the data, or like I'm filling out a form ABOUT the data?

Direct manipulation wins. Forms only when you genuinely need them (creating connections, configuring settings, destructive confirmations).

---

## What this gets you

If you ship even just P0 + P1, JustDB becomes a tool that's:

- **Faster than DBeaver** for everyday work (web is lighter than Eclipse-based UI).
- **More approachable than TablePlus** for non-Mac users.
- **More powerful than Beekeeper** for serious editing.
- **More fun than any of them** if you nail FK navigation.

That's a real wedge. Good luck Lukman, go cook.
