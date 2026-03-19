#!/usr/bin/env bash
set -euo pipefail

# Publish fork packages to npm:
#   @boltmcp/mcp-sdk-server  (packages/server)
#   @boltmcp/mcp-sdk-node    (packages/middleware/node)
#   @boltmcp/mcp-sdk-express (packages/middleware/express)
#
# Source code uses @modelcontextprotocol/* names — we rewrite only at publish time.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Package definitions: relative_dir:fork_name
PACKAGES=(
  "packages/server:@boltmcp/mcp-sdk-server"
  "packages/middleware/node:@boltmcp/mcp-sdk-node"
  "packages/middleware/express:@boltmcp/mcp-sdk-express"
)

DRY_RUN=false
NPM_TAG=""
VERSION=""
YES=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Publish @boltmcp fork packages to npm.

Options:
  --dry-run           Run pnpm publish --dry-run instead of actually publishing
  --tag <tag>         npm dist-tag (e.g., beta, next)
  --version <ver>     Override version in package.json
  --yes, -y           Skip interactive prompts (for CI)
  -h, --help          Show this help
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; shift ;;
    --tag)      NPM_TAG="$2"; shift 2 ;;
    --version)  VERSION="$2"; shift 2 ;;
    --yes|-y)   YES=true; shift ;;
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
  if $YES || [[ ! -t 0 ]]; then
    echo "Continuing (non-interactive mode)."
  else
    read -rp "Continue anyway? [y/N] " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  fi
fi

# --- Build (using original package names so monorepo resolves correctly) ---

echo "==> Installing dependencies..."
(cd "$REPO_ROOT" && pnpm install)

echo "==> Building all packages..."
(cd "$REPO_ROOT" && pnpm build:all)

# --- Cleanup trap: restore all .bak files on exit ---

cleanup() {
  for entry in "${PACKAGES[@]}"; do
    local dir="${entry%%:*}"
    local bak="$REPO_ROOT/$dir/package.json.bak"
    if [[ -f "$bak" ]]; then
      echo "==> Restoring $dir/package.json..."
      mv "$bak" "$REPO_ROOT/$dir/package.json"
    fi
  done
}
trap cleanup EXIT

# --- Publish args (shared across all packages) ---

PUBLISH_ARGS=(--access public --no-git-checks)
if [[ -n "${CI:-}" ]]; then
  PUBLISH_ARGS+=(--provenance)
fi
if [[ -n "$NPM_TAG" ]]; then
  PUBLISH_ARGS+=(--tag "$NPM_TAG")
fi
if $DRY_RUN; then
  PUBLISH_ARGS+=(--dry-run)
fi

# --- Read server version for peer dep resolution ---

SERVER_VERSION="$(node -p "require('$REPO_ROOT/packages/server/package.json').version")"
if [[ -n "$VERSION" ]]; then
  SERVER_VERSION="$VERSION"
fi

# --- Publish each package ---

for entry in "${PACKAGES[@]}"; do
  PKG_DIR_REL="${entry%%:*}"
  FORK_NAME="${entry##*:}"
  PKG_DIR="$REPO_ROOT/$PKG_DIR_REL"
  PKG_JSON="$PKG_DIR/package.json"

  echo ""
  if $DRY_RUN; then
    echo "==> Dry run: $FORK_NAME ($PKG_DIR_REL)..."
  else
    echo "==> Publishing $FORK_NAME ($PKG_DIR_REL)..."
  fi

  # Backup
  cp "$PKG_JSON" "$PKG_JSON.bak"

  # Rewrite package.json
  node - "$PKG_JSON" "$FORK_NAME" "$VERSION" "$SERVER_VERSION" <<'REWRITE_SCRIPT'
const fs = require('fs');
const [, , pkgPath, forkName, version, serverVersion] = process.argv;
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = forkName;
if (version) pkg.version = version;

// For middleware packages: rewrite @modelcontextprotocol/server peer dep
if (pkg.peerDependencies && pkg.peerDependencies['@modelcontextprotocol/server']) {
  delete pkg.peerDependencies['@modelcontextprotocol/server'];
  pkg.peerDependencies['@boltmcp/mcp-sdk-server'] = '^' + serverVersion;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
REWRITE_SCRIPT

  # Publish (prepack will run build + rewrite-fork-imports.cjs)
  (cd "$PKG_DIR" && pnpm publish "${PUBLISH_ARGS[@]}")

  # Restore immediately so subsequent packages can resolve workspace deps
  echo "==> Restoring $PKG_DIR_REL/package.json..."
  mv "$PKG_JSON.bak" "$PKG_JSON"
done

echo ""
echo "==> Done."
