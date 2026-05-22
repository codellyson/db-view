# DB Explorer

A lightweight PostgreSQL database explorer for quick data viewing.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL (pg)

## Project Structure

```
db-explorer/
├── app/
│   ├── api/          # API routes for database operations
│   ├── components/   # React components
│   ├── globals.css   # Global styles
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── lib/              # Utility functions and database connections
└── types/            # TypeScript type definitions
```

## Features (To Build)

- [ ] Database connection management
- [ ] Table listing
- [ ] Browse table data
- [ ] Simple query executor
- [ ] Search and filter

## Environment Variables

Create a `.env.local` file:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=your_database
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
```

## Desktop build (Tauri)

The `tauri-spike` branch wraps this app as a native desktop binary so users' DB credentials never leave their machine. The Rust side (in [src-tauri/](src-tauri/)) holds `tokio-postgres` connections; the Next.js UI loads in the Tauri webview and talks to Rust via `invoke()`.

### Prerequisites by OS

| OS | Required |
| --- | --- |
| macOS | Rust (`brew install rustup-init && rustup-init`), Xcode CLT (`xcode-select --install`) |
| Windows | Rust ([rustup-init.exe](https://rustup.rs)), [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Desktop C++ workload), WebView2 (preinstalled on Win10/11) |
| Linux (incl. WSL2) | Rust (rustup), `libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev libayatana-appindicator3-dev libxdo-dev` |

### Run the desktop app in dev

```bash
pnpm install
pnpm tauri:dev
```

The script starts `next dev -p 3030`, compiles the Rust binary, and opens a native window pointed at [http://localhost:3030/tauri-test](http://localhost:3030/tauri-test) (the spike test page).

### WSL2 caveat

WebKitGTK + WSLg is fragile: window draws but the WebView surface can render as 1×1 pixels. The `tauri:dev` script already sets the known stabilizers (`WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1`). If the window still won't render, build/run from the host OS (Mac, Windows PowerShell) instead — same repo, different toolchain.

### Architecture

- [src-tauri/src/lib.rs](src-tauri/src/lib.rs) — Tauri commands: `db_connect`, `db_query`, `db_disconnect`. Session-keyed connection store via `DashMap`.
- [src-tauri/src/postgres.rs](src-tauri/src/postgres.rs) — `tokio-postgres` client + type-aware row → JSON serialization (bool, int2/4/8, float4/8, text, json/jsonb, uuid, timestamp/tz, date, numeric).
- [app/tauri-test/page.tsx](app/tauri-test/page.tsx) — spike UI that calls `invoke('db_connect', { config })` and `invoke('db_query', { sessionId, sql })`.

For the production app, the SaaS at justdb.kreativekorna.com keeps the existing Next.js API routes; the desktop build uses the Rust commands instead.
