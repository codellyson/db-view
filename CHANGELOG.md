# Changelog

All notable changes to JustDB are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [0.1.14] - 2026-06-12
## [0.1.14] - 2026-06-12

### Fixed
- **tauri:** Bump libsql 0.6 → 0.9 to unblock Windows build ([6c6d2bc](https://github.com/codellyson/justdb/commit/6c6d2bc9ce4ade373dbc3ca05d6587b56b2b6211))

## [0.1.13] - 2026-06-12
## [0.1.13] - 2026-06-12

### Fixed
- **web:** Drop unused React import in smart-cell-display ([290c804](https://github.com/codellyson/justdb/commit/290c804bd01bf30f312603672b14aa240743fb00))

## [0.1.12] - 2026-06-12
## [0.1.12] - 2026-06-12

### Changed
- **web:** Collapse /connections route into Home ([fc3a765](https://github.com/codellyson/justdb/commit/fc3a7650e9ef1978a696f6f8b973b9f58bb11e86))

## [0.1.11] - 2026-06-12
## [0.1.11] - 2026-06-12

### Added
- **tauri:** SQLite + libsql/Turso browse-only backend (slice 1) ([3504f9c](https://github.com/codellyson/justdb/commit/3504f9c456116d21f4c4db06985c1a2b1e39e889))
- **web:** Cancel in-flight connect attempts from the connection form ([5677baa](https://github.com/codellyson/justdb/commit/5677baaabb449801f5e2cdcbb6d8273d2a5d2863))
- **web:** Smarter SQL autocomplete — curated keywords, FROM-context columns, gated schema source ([2ea5883](https://github.com/codellyson/justdb/commit/2ea58834e239876edfad56064df3bb3b375866fc))
- **web:** Collapse top nav into ConnectionSelector dropdown; restore landing logo ([6c371eb](https://github.com/codellyson/justdb/commit/6c371eb6a1500a6680c34db491f75801e3c25464))


### Fixed
- **web:** Connect was leaving sessionId null; ship SQLite write paths ([8c8819c](https://github.com/codellyson/justdb/commit/8c8819cb325ea91613a2ac8668aefbccc74d5b86))
- **web:** Use Tauri dialog to pick SQLite file instead of broken HTTP upload ([0285cad](https://github.com/codellyson/justdb/commit/0285cad26b0a308e34aa7328316ee539040b39dd))
- **web:** Keep cell editor focused when clicking inside the popover ([a23d4e5](https://github.com/codellyson/justdb/commit/a23d4e5f1a543f87ae1096cbfc3533061895b6a7))
- **tauri:** Surface full Postgres error detail instead of "db error" ([0b773fc](https://github.com/codellyson/justdb/commit/0b773fcd3a95d6aa570fe8be1d3f43debb063027))


### Maintenance
- **test:** Add SQLite test fixture (seed + prebuilt .db) ([a55ba22](https://github.com/codellyson/justdb/commit/a55ba225d488510f38a240ff311543cce978d60d))


### Performance
- **web:** Optimize DataTable rendering and limit query results ([74d67b7](https://github.com/codellyson/justdb/commit/74d67b7de74f42a9762f86b0d3a0f58505557a58))
- **web:** Cut paint/layout work in DataTable, cap result rows at 200 ([441a5e3](https://github.com/codellyson/justdb/commit/441a5e3c42853541708c0d217586e9457de49f9e))
- **web:** Replace DataTable with QueryResultGrid; compact Connections ([bb8ae56](https://github.com/codellyson/justdb/commit/bb8ae5681a824607a2997647b2c8e5eb25aef8df))

## [0.1.10] - 2026-06-07
## [0.1.10] - 2026-06-07

### Fixed
- **changelog:** Preserve manual edits across releases ([582b9af](https://github.com/codellyson/justdb/commit/582b9af7f0ce855c29d02896e9b52b501baa7962))
- **web:** Coerce ssl to bool, predictable scrollbars, hide unshipped backends ([1e8926d](https://github.com/codellyson/justdb/commit/1e8926d5208e078c45caddb84f13903580c677b2))

## [0.1.9] - 2026-06-06

### Added
- **web:** Row highlight, JSON portal, sensitive masking + small wins ([9307501](https://github.com/codellyson/justdb/commit/93075012c545b5cd1da5dfb4162c806336080e10))


### Maintenance
- Rewrite README, auto-hide scrollbars ([5a9fdb8](https://github.com/codellyson/justdb/commit/5a9fdb889f8c180b7a81b220f1083681c88b9156))

## [0.1.8] - 2026-06-05

### Added
- **marketing:** Add /changelog page reading from root CHANGELOG.md ([45bcf7b](https://github.com/codellyson/justdb/commit/45bcf7b333e145264606d3183aab9b215b9e0b4e))


### CI
- **marketing:** Unblock wrangler deploy by hoisting tslib ([77a3b64](https://github.com/codellyson/justdb/commit/77a3b640ccdb622c829e5aa6473667ad2bd33afd))


### Fixed
- **marketing:** Drop "Where are my credentials stored?" FAQ entry ([4d544d5](https://github.com/codellyson/justdb/commit/4d544d53d00b275f3b3678cd1ea4bd196dfe28c0))
- **web:** Single scroll container, leak-proof connection + tab swap ([6029028](https://github.com/codellyson/justdb/commit/6029028fa9b38d5999a998ceff092afe0212f344))

## [0.1.7] - 2026-06-05

### Changed
- **web:** Drop HTTP shim for typed Tauri client + UI polish ([797e117](https://github.com/codellyson/justdb/commit/797e117b3c7adedd3cdc4bc92cd3d10b5b31e528))


### Fixed
- **ui:** Align header with tab rail, color splitter, theme codemirror ([5f603c9](https://github.com/codellyson/justdb/commit/5f603c93278265530411e937adce94eba56440ee))


### Maintenance
- Drop apps/next, the migration is complete ([7417e82](https://github.com/codellyson/justdb/commit/7417e823f3586e2956e06041fa184ac0a97adb84))

## [0.1.6] - 2026-06-04

### Added
- Add table skeleton component for loading states ([6525f14](https://github.com/codellyson/justdb/commit/6525f14442b31c5d42dce133bb6c55f3ccba8f1d))
- Add table statistics API and components ([02b1d58](https://github.com/codellyson/justdb/commit/02b1d58769f99a411b8c9c666b97adf185a430a4))
- Add saved queries management, database provider interfaces, and MySQL/PostgreSQL implementations ([b2be39a](https://github.com/codellyson/justdb/commit/b2be39a29477083957c66b23daf7c52da7d5860c))
- Enhance TableCreationWizard with column management and unique IDs ([d712802](https://github.com/codellyson/justdb/commit/d7128026cc4421c85e8bb35681a6e3760ca44fca))
- Add template browser and editor components for SQL query templates ([eeebb36](https://github.com/codellyson/justdb/commit/eeebb3648b60fffe418a0ec880601f7c400e4aff))
- Mobile-first table view, tab system, and sidebar redesign ([894152c](https://github.com/codellyson/justdb/commit/894152c20f89f73af2ac83d8a3e8822425f67bca))
- Add SQLite support with file upload and database provider implementation ([f69e165](https://github.com/codellyson/justdb/commit/f69e165235883870b9a0b3c33a2ad43b83cce587))
- Implement query tab functionality with results display and error handling ([004e74e](https://github.com/codellyson/justdb/commit/004e74e4dd2a67c8a331371666994861e3425ecd))
- Implement saved connections management with CRUD operations and secure cookie storage ([a9e1011](https://github.com/codellyson/justdb/commit/a9e10118aaa9bec6738a25f5d34bd80d7a261ac0))
- Add custom headers for security policies in Next.js configuration ([8d10e2d](https://github.com/codellyson/justdb/commit/8d10e2d0c9fb1da031cee4cdf75b481c1b8c0371))
- Integrate PostHog for analytics tracking ([9d03115](https://github.com/codellyson/justdb/commit/9d03115b6671838b7e3b8984c0ebe3f7561f91dc))
- Add SQL editor functionality and improve dashboard navigation ([2044483](https://github.com/codellyson/justdb/commit/204448329ab1ad7605866382a12817c738c5208d))
- Enhance header navigation and add workspace button ([8e07508](https://github.com/codellyson/justdb/commit/8e075087fd87d1f5689c57c3c60e86141721f31c))
- Add query classification, rate limiting, and SQLite path sanitization ([1af040d](https://github.com/codellyson/justdb/commit/1af040d0bd391f026f72815090972fa28d3ad357))
- Isolate database pools per session and improve UX feedback ([9ff1175](https://github.com/codellyson/justdb/commit/9ff1175ef55320774e51ecbcb5fbcc28173bff2b))
- Ship full UX backlog (P0–P5) and upgrade to Next 16 ([41b7a1c](https://github.com/codellyson/justdb/commit/41b7a1c8a6c23d1a2bb6b4c9031505e64d9bd85c))
- **seo:** Add robots, sitemap, OG image, JSON-LD, per-page metadata ([fb4bf9b](https://github.com/codellyson/justdb/commit/fb4bf9bbcebfc3bac7fb87024d6cf4678222271d))
- **cascade:** Preview cascade impact in Review SQL before commit ([c67b10e](https://github.com/codellyson/justdb/commit/c67b10e002c38b8749bf60cdaffe0ea6e17f67cc))
- **query:** FK navigator and staged-edit parity in query results ([27505eb](https://github.com/codellyson/justdb/commit/27505eba163c45d666e481fa9d0e4660f1f68a11))
- **connection:** Auto-disconnect after 30 min idle, cross-tab aware ([252e589](https://github.com/codellyson/justdb/commit/252e589bddcbe34817de21b6cfd4ee3d50700d69))
- **tauri:** Spike desktop build with Rust postgres path ([e419b3c](https://github.com/codellyson/justdb/commit/e419b3c8169cb6a6f6b0d2a275fb2fc9993b40ba))
- **tauri:** Phase 0.5 dual-build — park /api before next build for desktop ([17186c4](https://github.com/codellyson/justdb/commit/17186c4369adb41efb3a6885092d8eb4361616dc))
- **tauri:** Phase 1 read-only browsing on desktop ([c854703](https://github.com/codellyson/justdb/commit/c854703f2ca3c1f2a43c449fd578ab6eff04187a))
- **tauri:** Phase 2 mutations on desktop ([5cd4976](https://github.com/codellyson/justdb/commit/5cd49765bfdac5e4411c4ee174b99a2ab75ab731))
- **tauri:** Phase 3 schema explorer + DDL on desktop ([61a8e10](https://github.com/codellyson/justdb/commit/61a8e103cf4402d6b761f3877dcb3feebfe35135))
- **tauri:** Phase 4 sidebar extras on desktop ([0b19b5c](https://github.com/codellyson/justdb/commit/0b19b5cc8cf0205292c9026426c98bd9fba0df4e))
- **tauri:** Phase 5 saved connections in OS keychain ([dd58b94](https://github.com/codellyson/justdb/commit/dd58b9455c257dfa2a2d703da0519ad991c653c9))
- **tauri:** SQL editor on desktop (db_run_query + classifier reuse) ([78ea344](https://github.com/codellyson/justdb/commit/78ea3446b87b9299416bd2bfbb4cff1fa6b7a4ed))
- **tauri:** Phase 3 closes — real cascade-preview port ([888a6f4](https://github.com/codellyson/justdb/commit/888a6f41b83394637cee5f14b1e67de30a373d63))
- **tauri:** /api/explain on desktop ([0ebbd5f](https://github.com/codellyson/justdb/commit/0ebbd5fd7da552bd5196ea29971848367df66d87))
- **tauri:** Wrap-up — CSV import, FK source on results, release profile ([00220cc](https://github.com/codellyson/justdb/commit/00220ccdcd384735dbab3661cdabab88fb181e69))
- **web:** "evaluation only" notice above the connection form ([ebc3b9b](https://github.com/codellyson/justdb/commit/ebc3b9b0397bb7fa8513bcaafdbb20af1c24f3b8))
- **tauri:** Custom themed title bar ([91878f1](https://github.com/codellyson/justdb/commit/91878f18d75536fe8f3d844fe597692b4639474b))
- **tauri:** In-app update notifications via tauri-plugin-updater ([ef331d0](https://github.com/codellyson/justdb/commit/ef331d00bbd165f20f4bf90138396e5c37461041))
- **export:** Export query results + native save dialog on desktop ([01044d4](https://github.com/codellyson/justdb/commit/01044d440d743bfbede2c624f321eb194c86c1da))
- **marketing:** Astro landing site + Cloudflare Pages deploy workflow ([98b3d04](https://github.com/codellyson/justdb/commit/98b3d0437a45dd08833980b1990e5d900990a154))
- **monorepo:** Convert to pnpm workspace, scaffold apps/web Vite shell ([74bbde1](https://github.com/codellyson/justdb/commit/74bbde15590d8fdfb597c74c6125f91d353d079d))
- **web:** Port the /connections page from Next.js to Vite ([f03e881](https://github.com/codellyson/justdb/commit/f03e881bf8c2a8db1a4ab80dc585aa431d041499))
- **tauri:** Switch desktop frontend from apps/next to apps/web ([970cc23](https://github.com/codellyson/justdb/commit/970cc23987ae4814d7fa123c1c2eec8a9908fa7e))
- **web:** Port Dashboard from apps/next to apps/web ([8dc0ec8](https://github.com/codellyson/justdb/commit/8dc0ec8f58ea304a871a1ec3be321506922c6955))
- **marketing:** Wire domain + justdb:// launch, drop SaaS messaging ([777bad7](https://github.com/codellyson/justdb/commit/777bad77ada09143e6ac5c87c118531b9ed0b8d5))
- **tauri:** Register justdb:// scheme + single-instance focus ([34b76f0](https://github.com/codellyson/justdb/commit/34b76f0130ad978af5db659001ce3711cf327365))
- **tauri:** Native overlay title bar on macOS ([79a7bf9](https://github.com/codellyson/justdb/commit/79a7bf9b4affbcc7fdec844adf3dc144af16e6ee))


### CI
- **tauri:** Cross-platform release matrix workflow ([b72e88d](https://github.com/codellyson/justdb/commit/b72e88d2bd9d0eb2ac01a4b17e58ce213aec953c))
- **tauri:** Pass TAURI_SIGNING_PRIVATE_KEY through to tauri-action ([9cb38e1](https://github.com/codellyson/justdb/commit/9cb38e164c99a32db259028fae5e0d2f8ff80492))
- **marketing:** Pass accountId so Pages-scoped tokens skip /memberships ([874df60](https://github.com/codellyson/justdb/commit/874df60937eb1d7f7b17784429b1ab03561e43e2))
- **marketing:** Source Cloudflare account ID from secrets ([d5ab68b](https://github.com/codellyson/justdb/commit/d5ab68b1f7f1dd95899faf9094aab544187fd148))


### Changed
- Comment out restrictive query validation logic ([bd90462](https://github.com/codellyson/justdb/commit/bd90462f0ea7bd7ff7b14d4b4140fcc1274cb044))
- **cells:** Render booleans as plain true/false text ([708cf81](https://github.com/codellyson/justdb/commit/708cf81e07dd4566a7e11f24978f941d367b6cd6))


### Documentation
- **tauri:** Phased migration plan from spike to v1 ([825d7f6](https://github.com/codellyson/justdb/commit/825d7f671cebecd614cace8156e35d2e32bd3b22))
- **ci:** Drop verbose header from release workflow ([daf6e5f](https://github.com/codellyson/justdb/commit/daf6e5fc9fbfafe4104c6873ea4a5649fb96693e))


### Fixed
- Update Content-Security-Policy to include www.kreativekorna.com ([1f49b27](https://github.com/codellyson/justdb/commit/1f49b278061ba0c262574b6254469c51aae5519b))
- Show loading feedback when switching database connections ([72c27a8](https://github.com/codellyson/justdb/commit/72c27a825cedbd5f67580705f67f9c53d0ebe4a6))
- Add row expand chevron and fix detail panel overlap ([26d2901](https://github.com/codellyson/justdb/commit/26d2901fed73512734665e156d7167c366316556))
- **build:** Pin Vercel build to webpack so Serwist runs ([1c869b9](https://github.com/codellyson/justdb/commit/1c869b9932ec023874d9f5fe043eae2d9e8aaf24))
- **og:** Drop edge runtime so OG image isn't capped at 1MB ([ffeba6b](https://github.com/codellyson/justdb/commit/ffeba6be9dd51d8eb49539035617458ddb2aa99d))
- **tauri:** Persist saved connections during /api/connect ([ec711e4](https://github.com/codellyson/justdb/commit/ec711e4485e2304ef94d8dc6fa8e6ab97ba8ca73))
- **web:** Drop the "credentials never leave this device" claim on web ([106c058](https://github.com/codellyson/justdb/commit/106c0584ebfbb178989bdb07177dece6f82190d4))
- **tauri:** Wrap tauri:dev env vars with cross-env for cross-platform ([9cb39fb](https://github.com/codellyson/justdb/commit/9cb39fbbc0468c8836945ba765afc8db98458ead))
- **tauri:** Set window background color to prevent white flash on resize ([587c8a7](https://github.com/codellyson/justdb/commit/587c8a7fe7cd7917a41e6e8eef3d450ce2ef42bc))
- **tauri:** Exclude landing page from desktop bundle ([2d007fd](https://github.com/codellyson/justdb/commit/2d007fdc0cdc5c04fad61f3471fcc54b1ef2c3e6))
- **tauri:** Keep landing page in desktop bundle, redirect to /connections instead ([1ae2c01](https://github.com/codellyson/justdb/commit/1ae2c01a17c000a4d08a5df967557b4a6e58f6ff))
- **tauri:** Don't redirect / to /connections when already connected ([b7f5d48](https://github.com/codellyson/justdb/commit/b7f5d485835546f180135167d0e2062a338b2492))
- **tauri:** Use dataTypeID (uppercase ID) on db_run_query fields ([124f9c2](https://github.com/codellyson/justdb/commit/124f9c2d76c38a17c6643efb1010b51f73e73252))
- **tauri:** Permissive fallback for un-handled column types ([f118faa](https://github.com/codellyson/justdb/commit/f118faa636014f74110d0a9a074079a0fb941457))
- **web:** Dashboard runtime fixes after first Tauri smoke test ([57740c6](https://github.com/codellyson/justdb/commit/57740c6ae7cbec1e5f7293f1c2d32f5b2af2bcb0))
- **release:** Restore macOS updater bundle ([6a8e8e3](https://github.com/codellyson/justdb/commit/6a8e8e38cc5169a3b9f0d8ab7a1551adae20a354))
- **marketing:** Make CTA href the justdb:// protocol ([2488f2e](https://github.com/codellyson/justdb/commit/2488f2ea23a1948629e166cda9d9c406b221042a))
- **web:** Mount TauriTitleBar, ThemeToggle, UpdatePrompt in App ([c65ca3b](https://github.com/codellyson/justdb/commit/c65ca3b7b9fa9845d7cdad9f364b4e6239890e5e))


### Maintenance
- Rewrite app copy for pocket DB explorer positioning ([6694450](https://github.com/codellyson/justdb/commit/66944501dcf8752c9ed120267fdc945a38455370))
- **rename:** DBView → Pocketdb across user-facing strings ([e404868](https://github.com/codellyson/justdb/commit/e4048684690c61fa8455b5e79d7454ed7350e057))
- **rename:** Pocketdb → JustDB and rewrite landing for SEO ([a909452](https://github.com/codellyson/justdb/commit/a909452724ef4d1679e2d4b3b8392b9ff9970ddf))
- **posthog:** Hard-disable session recording, surveys, heatmaps ([c7c0277](https://github.com/codellyson/justdb/commit/c7c0277492f9ab02ebf60cfcf6566266b3788d68))
- Add .gitattributes to normalize line endings to LF ([8b9cb54](https://github.com/codellyson/justdb/commit/8b9cb54559945c714a6f1ae18ad952ca44e72405))
- **tauri:** Replace scaffold icons with JustDB brand ([9dd4cc8](https://github.com/codellyson/justdb/commit/9dd4cc8f0c6dfc7aa71651c53e05cf9fb6d209d7))
- **landing:** Rewrite hero, sections, and FAQ for desktop-first positioning ([5f624d8](https://github.com/codellyson/justdb/commit/5f624d8404e8991e86cc2c79ed9163dedb0e2df1))
- Remove decorative section divider comments ([fa393a8](https://github.com/codellyson/justdb/commit/fa393a8ffdc3d78ed7f1fdc3499cc97628ce9864))
- **app:** Strip landing JSX — marketing now lives in Astro ([066dbf3](https://github.com/codellyson/justdb/commit/066dbf3e8cf0013fd410c323076711ca1a043205))
- **app:** Drop SoftwareApplication JSON-LD from Next root layout ([9b1a0ce](https://github.com/codellyson/justdb/commit/9b1a0ceb2ad01efa15aa462d71b5d9ebca0d6cbb))
- Fix .gitignore patterns + pin Vite dev port ([4c0cb66](https://github.com/codellyson/justdb/commit/4c0cb66da84adad97497d3dbcf6fe0ecee7960d7))


