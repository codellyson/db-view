# Changelog

All notable changes to JustDB are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [0.1.7] - 2026-06-05

### Changed
- **web:** Drop HTTP shim for typed Tauri client + UI polish ([797e117](https://github.com/codellyson/justdb/commit/797e117b3c7adedd3cdc4bc92cd3d10b5b31e528))


### Fixed
- **ui:** Align header with tab rail, color splitter, theme codemirror ([5f603c9](https://github.com/codellyson/justdb/commit/5f603c93278265530411e937adce94eba56440ee))


### Maintenance
- Drop apps/next, the migration is complete ([7417e82](https://github.com/codellyson/justdb/commit/7417e823f3586e2956e06041fa184ac0a97adb84))
- **changelog:** Wire up git-cliff for auto-generated release notes ([2b83fd9](https://github.com/codellyson/justdb/commit/2b83fd967d667e6c2deb6b28c7ce7eb5b707cd33))

## [0.1.6] - 2026-06-04

### Added
- **tauri:** Native overlay title bar on macOS ([79a7bf9](https://github.com/codellyson/justdb/commit/79a7bf9b4affbcc7fdec844adf3dc144af16e6ee))


### Fixed
- **release:** Restore macOS updater bundle ([6a8e8e3](https://github.com/codellyson/justdb/commit/6a8e8e38cc5169a3b9f0d8ab7a1551adae20a354))
- **marketing:** Make CTA href the justdb:// protocol ([2488f2e](https://github.com/codellyson/justdb/commit/2488f2ea23a1948629e166cda9d9c406b221042a))
- **web:** Mount TauriTitleBar, ThemeToggle, UpdatePrompt in App ([c65ca3b](https://github.com/codellyson/justdb/commit/c65ca3b7b9fa9845d7cdad9f364b4e6239890e5e))

## [0.1.5] - 2026-06-04

### Added
- **export:** Export query results + native save dialog on desktop ([01044d4](https://github.com/codellyson/justdb/commit/01044d440d743bfbede2c624f321eb194c86c1da))
- **marketing:** Astro landing site + Cloudflare Pages deploy workflow ([98b3d04](https://github.com/codellyson/justdb/commit/98b3d0437a45dd08833980b1990e5d900990a154))
- **monorepo:** Convert to pnpm workspace, scaffold apps/web Vite shell ([74bbde1](https://github.com/codellyson/justdb/commit/74bbde15590d8fdfb597c74c6125f91d353d079d))
- **web:** Port the /connections page from Next.js to Vite ([f03e881](https://github.com/codellyson/justdb/commit/f03e881bf8c2a8db1a4ab80dc585aa431d041499))
- **tauri:** Switch desktop frontend from apps/next to apps/web ([970cc23](https://github.com/codellyson/justdb/commit/970cc23987ae4814d7fa123c1c2eec8a9908fa7e))
- **web:** Port Dashboard from apps/next to apps/web ([8dc0ec8](https://github.com/codellyson/justdb/commit/8dc0ec8f58ea304a871a1ec3be321506922c6955))
- **marketing:** Wire domain + justdb:// launch, drop SaaS messaging ([777bad7](https://github.com/codellyson/justdb/commit/777bad77ada09143e6ac5c87c118531b9ed0b8d5))
- **tauri:** Register justdb:// scheme + single-instance focus ([34b76f0](https://github.com/codellyson/justdb/commit/34b76f0130ad978af5db659001ce3711cf327365))


