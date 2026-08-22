# CLI reference

Install `@openmirai/typeforge` from [npmjs](https://www.npmjs.com/package/@openmirai/typeforge). Add a script so the binary resolves from `node_modules/.bin`:

```json
{
  "scripts": {
    "generate:types": "typeforge generate --all"
  }
}
```

## Install

| Package manager | Command |
| --- | --- |
| npm | `npm install --save-dev @openmirai/typeforge` |
| pnpm | `pnpm add -D @openmirai/typeforge` |
| yarn | `yarn add -D @openmirai/typeforge` |
| bun | `bun add -d @openmirai/typeforge` |

## Commands × package managers

Replace `<args>` with the flags for that subcommand (see below).

| Subcommand | npm | pnpm | yarn | bun |
| --- | --- | --- | --- | --- |
| `init <args>` | `npx typeforge init <args>` | `pnpm exec typeforge init <args>` | `yarn typeforge init <args>` | `bunx typeforge init <args>` |
| `generate <args>` | `npx typeforge generate <args>` | `pnpm exec typeforge generate <args>` | `yarn typeforge generate <args>` | `bunx typeforge generate <args>` |
| `check <args>` | `npx typeforge check <args>` | `pnpm exec typeforge check <args>` | `yarn typeforge check <args>` | `bunx typeforge check <args>` |
| `accept-base <args>` | `npx typeforge accept-base <args>` | `pnpm exec typeforge accept-base <args>` | `yarn typeforge accept-base <args>` | `bunx typeforge accept-base <args>` |

Recommended day-to-day: `npm run generate:types` (or the equivalent for your package manager).

## Subcommands

### `init`

```bash
typeforge init --source <key> --client axios|fetch|custom [--layout monolith|packages]
```

Creates `http.ts`, `known-types.ts`, `source.ts`, and `generated/` under `apiRoot`.

### `generate`

```bash
typeforge generate --source <key> [--source <key2> ...] [--spec <path>] [--check] [--accept-base]
typeforge generate --all [--check] [--accept-base]
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
4. `typeforge.local.json` (gitignored)
5. `<apiRoot>/<key>/spec.json` snapshot

## Type-safe `source.ts`

```ts
import { defineSourceConfig } from "@openmirai/typeforge";

export default defineSourceConfig({
  spec: "./specs/acme.json",
  pathPrefix: "/api/acme/v3",
  generationMode: "authoritative",
  naming: "path",
});
```

The CLI reads `source.ts` at generate time (including `defineSourceConfig(...)` wrappers). Use synthetic paths like `/api/acme/v3` in examples and tests.
