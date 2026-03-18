# Fork: @boltmcp/mcp-sdk-server

This is a fork of the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (`modelcontextprotocol/typescript-sdk`). It publishes the `server` package to npm as `@boltmcp/mcp-sdk-server` with custom modifications.

## Branch Strategy

- **`main`** — Mirror of upstream. Never commit directly; updated via `sync-upstream.sh`.
- **`custom`** — Working branch. Fork-specific files and any custom patches live here.

## How the Rename Works

Source code uses `@modelcontextprotocol/server` everywhere — the monorepo resolves via `workspace:^` normally. At publish time, two things happen:

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

## Syncing with Upstream

```sh
./scripts/sync-upstream.sh
```

This fast-forwards `main` to `upstream/main`, then rebases `custom` onto it. If there are conflicts, resolve them and run `git rebase --continue`.

## Publishing

Dry run first:
```sh
./scripts/publish-fork.sh --dry-run
```

Publish a specific version:
```sh
./scripts/publish-fork.sh --version 2.0.0
```

With a dist-tag:
```sh
./scripts/publish-fork.sh --version 2.0.0-beta.1 --tag beta
```

## Consumer Usage

```sh
npm install @boltmcp/mcp-sdk-server
```

```ts
import { McpServer } from '@boltmcp/mcp-sdk-server';
```

The API is identical to `@modelcontextprotocol/server`.
