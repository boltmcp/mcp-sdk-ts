# Fork: @boltmcp/mcp-sdk-server

This is a fork of the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (`modelcontextprotocol/typescript-sdk`). It publishes the `server` package to npm as `@boltmcp/mcp-sdk-server` with custom modifications.

## Branch Strategy

- **`main`** — Mirror of upstream. Never commit directly; updated via `sync-upstream.sh`.
- **`custom`** — Working branch. Fork-specific files and any custom patches live here.

## What Changes at Publish Time

Source code uses `@modelcontextprotocol/server` everywhere — the monorepo resolves normally. At publish time, `scripts/publish-fork.sh` temporarily rewrites:

1. `packages/server/package.json` `name` field → `@boltmcp/mcp-sdk-server`
2. Self-referencing `@modelcontextprotocol/server/_shims` imports in `dist/` → `@boltmcp/mcp-sdk-server/_shims`

The original `package.json` is restored automatically after publish (via `trap`).

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
