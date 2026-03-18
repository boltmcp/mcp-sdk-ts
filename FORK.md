# Fork: @boltmcp/mcp-sdk-server

This is a fork of the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (`modelcontextprotocol/typescript-sdk`). It publishes the `server` package to npm as `@boltmcp/mcp-sdk-server` with custom modifications.

## Consumer Usage

```sh
npm install @boltmcp/mcp-sdk-server
```

```ts
import { McpServer } from '@boltmcp/mcp-sdk-server';
```

The API is identical to `@modelcontextprotocol/server` — it's a drop-in replacement.

## Branch Strategy

- **`main`** — Mirror of upstream. Never commit directly; updated via `sync-upstream.sh`.
- **`custom`** — Default branch. Fork-specific files and any custom patches live here.

## PR Workflow

1. Create a feature branch off `custom`
2. Open a PR targeting `custom`
3. Fork CI runs build-and-test + validate-publish (dry-run); Claude Code Review runs automatically
4. Merge to `custom`

## Publishing

### Tag-based release (recommended)

Tag the commit and push — CI handles the rest:

```sh
git tag fork-v2.0.0
git push origin fork-v2.0.0
```

To tag a specific commit (e.g., after syncing upstream):

```sh
git tag fork-v2.1.0 abc1234
git push origin fork-v2.1.0
```

The npm dist-tag is auto-detected from the version:

| Version pattern             | npm dist-tag | Example tag              |
|-----------------------------|-------------|--------------------------|
| `2.0.0` (stable)           | `latest`    | `fork-v2.0.0`            |
| `2.0.0-beta.1` (`-beta*`)  | `beta`      | `fork-v2.0.0-beta.1`     |
| `2.0.0-boltmcp.1` (other)  | `next`      | `fork-v2.0.0-boltmcp.1`  |

CI will: build + test (Node 20/22/24) → validate-publish (dry-run) → publish (waits for environment approval if configured).

### Manual release (workflow_dispatch)

Use the "Run workflow" button in GitHub Actions on the `custom` branch with `publish: true` and optional `version`/`tag` inputs.

### Local publish

```sh
./scripts/publish-fork.sh --dry-run                          # dry run first
./scripts/publish-fork.sh --version 2.0.0                    # publish stable
./scripts/publish-fork.sh --version 2.0.0-beta.1 --tag beta  # with dist-tag
```

## Versioning Strategy

- **Stable releases** mirror upstream versions (e.g., `2.0.0` when upstream is `2.0.0`)
- **Fork-specific patches** use `X.Y.Z-boltmcp.N` (e.g., `2.0.0-boltmcp.1`) — these get the `next` dist-tag automatically

## Syncing with Upstream

```sh
./scripts/sync-upstream.sh
```

This fast-forwards `main` to `upstream/main`, then rebases `custom` onto it. If there are conflicts, resolve them and run `git rebase --continue`.

After syncing, run `pnpm check:all && pnpm test:all` to verify, then push `custom`.

## How the Rename Works

**TL;DR:** Source code always uses `@modelcontextprotocol/server`. At publish time, `publish-fork.sh` temporarily renames the package and `prepack` rewrites `dist/` imports. Everything is restored after publish.

### Temporary: `name` field rewrite

`scripts/publish-fork.sh` temporarily rewrites `packages/server/package.json` `name` to `@boltmcp/mcp-sdk-server` before calling `npm pack`/`npm publish`, then restores the original via `trap`. This must be temporary because other workspace packages (middleware, examples) reference `@modelcontextprotocol/server` via `workspace:^` — changing the name permanently would break monorepo resolution.

### Permanent: `prepack` script

The `prepack` script in `packages/server/package.json` is permanently changed to:
```
"prepack": "pnpm run build && node ../../scripts/rewrite-fork-imports.cjs"
```

This is safe because `prepack` only runs during `npm pack`/`npm publish`, never during normal development (`pnpm install`, `pnpm build`, etc.). The low rebase-conflict risk is acceptable since upstream rarely touches this field.

### `scripts/rewrite-fork-imports.cjs`

This Node script walks all files in `packages/server/dist/` and replaces every occurrence of `@modelcontextprotocol/server` with `@boltmcp/mcp-sdk-server`. This is deliberately broad — it catches any self-referencing externals (currently `_shims` imports), and will automatically handle any new subpath exports upstream may add in the future.

The script is guarded: it only rewrites when `package.json` `name` is already `@boltmcp/mcp-sdk-server`. This means normal `pnpm pack` (e.g., in tests) is unaffected — only `publish-fork.sh` (which rewrites `name` first) triggers the dist rewrite.

## Fork-Specific Files

These files are added or modified by this fork. Fewer fork-specific files = easier rebases.

| File | Status | Rebase risk |
|------|--------|-------------|
| `FORK.md` | Added | None (fork-only) |
| `scripts/publish-fork.sh` | Added | None (fork-only) |
| `scripts/rewrite-fork-imports.cjs` | Added | None (fork-only) |
| `scripts/sync-upstream.sh` | Added | None (fork-only) |
| `.github/workflows/fork-ci.yml` | Added | None (fork-only) |
| `.github/workflows/claude-code-review.yml` | Added | None (fork-only) |
| `.github/workflows/publish.yml` | Modified | Low (added repo guard) |
| `packages/server/package.json` | Modified | Low (only `prepack` field changed) |

## Workflows

| Workflow | Active on fork? | Notes |
|----------|----------------|-------|
| `fork-ci.yml` | Yes | Build, test, publish for `custom` branch and `fork-v*` tags |
| `claude-code-review.yml` | Yes | Runs on PRs to `custom` |
| `main.yml` | No | Upstream CI, only triggers on `main` |
| `release.yml` | No | Upstream release process |
| `deploy-docs.yml` | No | Upstream docs deployment |
| `conformance.yml` | No | Upstream conformance tests |
| `update-spec-types.yml` | No | Upstream spec type generation |
| `claude.yml` | No | Upstream Claude bot |
| `publish.yml` | No | Upstream pkg-pr-new previews (repo guard skips on fork) |

## GitHub Setup

### Default branch

Set the default branch to `custom` (Settings → General → Default branch). This ensures PRs target `custom` by default and that workflow OIDC validation works for Claude Code Review.

### Required secrets

- **`NPM_TOKEN`** — npm publish token with write access to `@boltmcp` scope
- **`ANTHROPIC_API_KEY`** — for Claude Code Review on PRs

### Release environment (recommended)

1. Go to Settings → Environments → New environment → name it `release`
2. Add required reviewers for a manual approval gate before publishing
3. Optionally restrict deployment branches to `custom` branch and `fork-v*` tags
