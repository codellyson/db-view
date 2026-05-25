#!/usr/bin/env node
// Phase 0.5 of the Tauri migration (see docs/tauri-migration.md).
//
// Next.js `output: 'export'` is required for the Tauri prod bundle, but it
// refuses to build a project that has `app/api/*` route handlers or
// middleware. This script temporarily parks the SaaS-only pieces, swaps in a
// Tauri-only next.config, runs `next build`, then restores everything — even
// on crash or Ctrl+C.

import { execSync } from "node:child_process";
import {
  existsSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// [source, parked] pairs. Parked names are loud on purpose so a leaked file
// after a crashed run is obvious in `git status` and grep-able.
const MOVES = [
  ["app/api", "app/__tauri_parked_api__"],
  ["middleware.ts", "__tauri_parked_middleware__.ts"],
  ["next.config.mjs", "__tauri_parked_next.config.mjs"],
  // SEO-only routes. `output: 'export'` rejects them unless they're forced
  // static, and they're meaningless in a Tauri webview (no crawler, no public
  // URL). Park them alongside the API.
  ["app/robots.ts", "app/__tauri_parked_robots__.ts"],
  ["app/sitemap.ts", "app/__tauri_parked_sitemap__.ts"],
  ["app/opengraph-image.tsx", "app/__tauri_parked_opengraph-image__.tsx"],
  // The web landing page (marketing copy, download CTAs, FAQ). Tauri opens
  // directly at /connections, so `/` is unused inside the desktop app —
  // shipping it would just bundle download buttons that point at the very
  // app the user is already running.
  ["app/page.tsx", "app/__tauri_parked_page__.tsx"],
];

const TAURI_NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};
export default nextConfig;
`;

const NEXT_CONFIG_PATH = resolve(ROOT, "next.config.mjs");

const parked = [];

function park() {
  for (const [src, dst] of MOVES) {
    const from = resolve(ROOT, src);
    const to = resolve(ROOT, dst);
    if (existsSync(to)) {
      throw new Error(
        `Parked path already exists: ${dst}. A previous build likely crashed mid-way. ` +
          `Restore by hand (mv ${dst} ${src}) before re-running.`,
      );
    }
    if (!existsSync(from)) continue;
    renameSync(from, to);
    parked.push([from, to]);
  }
  writeFileSync(NEXT_CONFIG_PATH, TAURI_NEXT_CONFIG);
}

function restore() {
  // Only delete the tauri config if we actually parked the original.
  const originalConfigParked = parked.some(([, to]) =>
    to.endsWith("__tauri_parked_next.config.mjs"),
  );
  if (originalConfigParked && existsSync(NEXT_CONFIG_PATH)) {
    try {
      unlinkSync(NEXT_CONFIG_PATH);
    } catch (e) {
      console.error(
        `[prepare-tauri-build] failed to remove tauri next.config: ${e.message}`,
      );
    }
  }

  while (parked.length) {
    const [from, to] = parked.pop();
    try {
      renameSync(to, from);
    } catch (e) {
      console.error(
        `[prepare-tauri-build] failed to restore ${to} -> ${from}: ${e.message}`,
      );
    }
  }
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    console.error(`[prepare-tauri-build] received ${sig}, restoring`);
    restore();
    process.exit(130);
  });
}

try {
  park();
  console.log("[prepare-tauri-build] parked SaaS-only files, running next build");
  execSync("next build", { cwd: ROOT, stdio: "inherit" });
} catch (err) {
  console.error(`[prepare-tauri-build] build failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  restore();
}
