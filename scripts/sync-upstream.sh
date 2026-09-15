#!/usr/bin/env bash
set -euo pipefail

# Sync fork with upstream (modelcontextprotocol/typescript-sdk)
# main = upstream mirror, custom = working branch with fork changes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Validation ---

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

if ! git remote | grep -q '^upstream$'; then
  echo "ERROR: No 'upstream' remote found."
  echo "Run: git remote add upstream https://github.com/modelcontextprotocol/typescript-sdk.git"
  exit 1
fi

# --- Fetch upstream ---

echo "==> Fetching upstream..."
git fetch upstream

# --- Update main ---

echo "==> Fast-forwarding main to upstream/main..."
git checkout main
git merge upstream/main --ff-only
git push origin main

# --- Rebase custom onto main ---

echo "==> Rebasing custom onto main..."
git checkout custom

if ! git rebase main; then
  echo ""
  echo "==> Rebase conflicts detected. Resolve them, then run:"
  echo "    git rebase --continue"
  echo "    git push origin custom --force-with-lease"
  exit 1
fi

echo "==> Pushing custom branch..."
git push origin custom --force-with-lease

echo "==> Sync complete."
