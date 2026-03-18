#!/usr/bin/env bash
set -euo pipefail

# Publish the server package as @boltmcp/mcp-sdk-server
# Source code uses @modelcontextprotocol/server — we rewrite only at publish time.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$REPO_ROOT/packages/server"
PKG_JSON="$SERVER_DIR/package.json"
PKG_JSON_BAK="$SERVER_DIR/package.json.bak"

DRY_RUN=false
NPM_TAG=""
VERSION=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Publish @boltmcp/mcp-sdk-server to npm.

Options:
  --dry-run           Run npm pack --dry-run instead of npm publish
  --tag <tag>         npm dist-tag (e.g., beta, next)
  --version <ver>     Override version in package.json
  -h, --help          Show this help
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; shift ;;
    --tag)      NPM_TAG="$2"; shift 2 ;;
    --version)  VERSION="$2"; shift 2 ;;
    -h|--help)  usage ;;
    *)          echo "Unknown option: $1"; usage ;;
  esac
done

# --- Validation ---

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "custom" ]]; then
  echo "WARNING: Not on 'custom' branch (currently on '$BRANCH')."
  read -rp "Continue anyway? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

# --- Build (using original package names so monorepo resolves correctly) ---

echo "==> Installing dependencies..."
(cd "$REPO_ROOT" && pnpm install)

echo "==> Building all packages..."
(cd "$REPO_ROOT" && pnpm build:all)

# --- Rewrite package.json ---

cleanup() {
  if [[ -f "$PKG_JSON_BAK" ]]; then
    echo "==> Restoring original package.json..."
    mv "$PKG_JSON_BAK" "$PKG_JSON"
  fi
}
trap cleanup EXIT

cp "$PKG_JSON" "$PKG_JSON_BAK"

echo "==> Rewriting package.json name to @boltmcp/mcp-sdk-server..."

# Use node for reliable JSON manipulation (heredoc avoids bash escaping issues)
node - "$PKG_JSON" "$VERSION" <<'REWRITE_SCRIPT'
const fs = require('fs');
const [, , pkgPath, version] = process.argv;
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = '@boltmcp/mcp-sdk-server';
if (version) pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
REWRITE_SCRIPT

# --- Publish or dry-run ---

PUBLISH_ARGS=(--access public)
if [[ -n "$NPM_TAG" ]]; then
  PUBLISH_ARGS+=(--tag "$NPM_TAG")
fi

if $DRY_RUN; then
  echo "==> Dry run: npm pack --dry-run"
  (cd "$SERVER_DIR" && npm pack --dry-run)
else
  echo "==> Publishing @boltmcp/mcp-sdk-server..."
  (cd "$SERVER_DIR" && npm publish "${PUBLISH_ARGS[@]}")
fi

echo "==> Done."
