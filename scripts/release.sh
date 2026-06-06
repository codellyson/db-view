#!/usr/bin/env bash
# Cut a new desktop release end-to-end.
#
#   pnpm release            # auto-bump the patch version
#   pnpm release 0.2.0      # cut an explicit version
#   pnpm release -y         # auto-bump, no confirmation prompt
#
# Performs: pre-flight checks → bump version in Cargo.toml +
# tauri.conf.json + root package.json → refresh Cargo.lock →
# regenerate CHANGELOG.md with --tag vX.Y.Z → commit "chore(release):
# vX.Y.Z" → tag → push commit + tag.
#
# The tag push fires the Release workflow (tauri-action builds and
# uploads the .dmg/.exe/.msi to the GitHub Release) and the Changelog
# workflow (posts the tag-scoped section to the release body, commits
# the refreshed CHANGELOG.md back to main).

set -euo pipefail

cd "$(dirname "$0")/.."

ASSUME_YES=0
NEXT=""
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    *)        NEXT="$arg" ;;
  esac
done

# ─── Pre-flight ────────────────────────────────────────────────────────

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ Working tree not clean. Commit or stash first." >&2
  git status --short >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "✗ On branch '$BRANCH'. Releases must be cut from main." >&2
  exit 1
fi

# Make sure local main matches origin/main so the tag points where we expect.
git fetch origin main --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "✗ main is not in sync with origin. Pull or push first." >&2
  echo "  local:  $LOCAL"  >&2
  echo "  remote: $REMOTE" >&2
  exit 1
fi

# ─── Compute the next version ──────────────────────────────────────────

CURRENT="$(awk -F'"' '/"version":/ {print $4; exit}' src-tauri/tauri.conf.json)"

if [[ -z "$NEXT" ]]; then
  IFS='.' read -r MAJ MIN PAT <<< "$CURRENT"
  NEXT="$MAJ.$MIN.$((PAT + 1))"
fi

if [[ ! "$NEXT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✗ Invalid version: '$NEXT' (expected X.Y.Z)" >&2
  exit 1
fi

TAG="v$NEXT"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "✗ Tag $TAG already exists." >&2
  exit 1
fi

echo "→ Cutting $CURRENT → $NEXT (tag $TAG)"

if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "  Proceed? [y/N] " REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

# ─── Bump version files ────────────────────────────────────────────────

# Use -i.bak for BSD/GNU sed portability, then clean up the backup.
sed -i.bak -E "s/^version = \"[0-9.]+\"$/version = \"$NEXT\"/" src-tauri/Cargo.toml && rm src-tauri/Cargo.toml.bak
sed -i.bak "s/\"version\": \"$CURRENT\"/\"version\": \"$NEXT\"/" src-tauri/tauri.conf.json && rm src-tauri/tauri.conf.json.bak
sed -i.bak "s/\"version\": \"$CURRENT\"/\"version\": \"$NEXT\"/" package.json                && rm package.json.bak

echo "→ Refreshing Cargo.lock…"
(cd src-tauri && cargo check --message-format=short 2>&1 | tail -2)

echo "→ Prepending the $TAG section to CHANGELOG.md…"
# --prepend keeps everything currently in CHANGELOG.md intact and just
# adds the new release's section at the top. Manual polish on past
# sections (better wording, dropped noisy entries, added context) is
# preserved across releases.
pnpm exec git-cliff --tag "$TAG" --unreleased --prepend CHANGELOG.md 2>&1 | tail -1

# ─── Commit, tag, push ─────────────────────────────────────────────────

echo "→ Commit + tag + push…"
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock package.json CHANGELOG.md
git commit -m "chore(release): $TAG"
git tag "$TAG"
git push origin main
git push origin "$TAG"

echo
echo "✓ Released $TAG"
echo "  • Watch the build:    gh run watch \$(gh run list --workflow=Release --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status"
echo "  • Release page:       https://github.com/codellyson/justdb/releases/tag/$TAG"
echo "  • Public changelog:   https://justdb.kreativekorna.com/changelog"
