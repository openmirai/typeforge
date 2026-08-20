# CLI reference

Install `@openmirai/openapi-codegen` from [npmjs](https://www.npmjs.com/package/@openmirai/openapi-codegen). Add a script so the binary resolves from `node_modules/.bin`:

```json
{
  "scripts": {
    "generate:types": "openapi-codegen generate --all"
  }
}
```

## Install

| Package manager | Command |
| --- | --- |
| npm | `npm install --save-dev @openmirai/openapi-codegen` |
| pnpm | `pnpm add -D @openmirai/openapi-codegen` |
| yarn | `yarn add -D @openmirai/openapi-codegen` |
| bun | `bun add -d @openmirai/openapi-codegen` |

## Commands × package managers

Replace `<args>` with the flags for that subcommand (see below).

| Subcommand | npm | pnpm | yarn | bun |
| --- | --- | --- | --- | --- |
| `init <args>` | `npx openapi-codegen init <args>` | `pnpm exec openapi-codegen init <args>` | `yarn openapi-codegen init <args>` | `bunx openapi-codegen init <args>` |
| `generate <args>` | `npx openapi-codegen generate <args>` | `pnpm exec openapi-codegen generate <args>` | `yarn openapi-codegen generate <args>` | `bunx openapi-codegen generate <args>` |
| `check <args>` | `npx openapi-codegen check <args>` | `pnpm exec openapi-codegen check <args>` | `yarn openapi-codegen check <args>` | `bunx openapi-codegen check <args>` |
| `accept-base <args>` | `npx openapi-codegen accept-base <args>` | `pnpm exec openapi-codegen accept-base <args>` | `yarn openapi-codegen accept-base <args>` | `bunx openapi-codegen accept-base <args>` |

Recommended day-to-day: `npm run generate:types` (or the equivalent for your package manager).

## Subcommands

### `init`

```bash
openapi-codegen init --source <key> --client axios|fetch|custom [--layout monolith|packages]
```

Creates `http.ts`, `known-types.ts`, `source.ts`, and `generated/` under `apiRoot`.

### `generate`

```bash
openapi-codegen generate --source <key> [--source <key2> ...] [--spec <path>] [--check] [--accept-base]
openapi-codegen generate --all [--check] [--accept-base]
```

`--all` walks every directory under `apiRoot` that contains `source.ts`.

### `check`

Shorthand for `generate --check`. Exits with code 1 when generated files would change.

### `accept-base`

Updates `generated/base.ts` and patches `models.ts` `BaseResponse` to match the spec envelope.

## Common flags

| Flag | Applies to | Meaning |
| --- | --- | --- |
| `--source <key>` | init, generate, check, accept-base | Source directory name under `apiRoot` |
| `--all` | generate | Generate every source |
| `--spec <path>` | generate, check, accept-base | Override spec path for this run |
| `--check` | generate | Drift check only; do not write files |
| `--accept-base` | generate | Accept envelope base type drift |
| `--client axios\|fetch\|custom` | init | HTTP adapter template |
| `--layout monolith\|packages` | init | Default `apiRoot` layout |

`--check` and `--accept-base` cannot be used together.

## Spec resolution order

1. `--spec <path>`
2. Environment variable `OPENAPI_SPEC_<KEY>` (key uppercased, `-` → `_`)
3. `spec` field in `<apiRoot>/<key>/source.ts`
4. `openapi-codegen.local.json` (gitignored)
5. `<apiRoot>/<key>/spec.json` snapshot

## Type-safe `source.ts`

```ts
import { defineSourceConfig } from "@openmirai/openapi-codegen";

export default defineSourceConfig({
  spec: "./specs/acme.json",
  pathPrefix: "/api/acme/v3",
  generationMode: "authoritative",
  naming: "path",
});
```

The CLI reads `source.ts` at generate time (including `defineSourceConfig(...)` wrappers). Use synthetic paths like `/api/acme/v3` in examples and tests.
