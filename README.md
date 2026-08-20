# @openmirai/openapi-codegen

Headless **OpenAPI / Swagger → TypeScript** codegen. The CLI is `openapi-codegen`. It reads a spec, writes typed route enums, request types, and HTTP caller functions, and never talks to a network.

- **npm:** [`@openmirai/openapi-codegen`](https://www.npmjs.com/package/@openmirai/openapi-codegen)
- **GitHub:** [openmirai/mirai-openapi-codegen](https://github.com/openmirai/mirai-openapi-codegen)

You own `http.ts` (the `HTTPFetch` adapter). Generated files import that adapter — they do not invent axios/fetch calls inline.

## What it generates

For each **source** (a named API, e.g. `atlas`), under `<apiRoot>/<source>/generated/`:

| Output | Role |
| --- | --- |
| `types/**/*.d.ts` | Params, body, and response types per operation |
| `functions/**/*.ts` | Typed callers (`getWidgets`, …) |
| `routes.ts` | `Routes` string map + `RouteTargets` enum (name configurable) |
| `runtime.ts` | Re-exports `HTTPFetch`, `httpFetch` (if singleton), routes |
| `base.ts` | `BaseResponse<T>` when the spec uses a response envelope (or `base.d.ts` for split declaration output) |

Optional:

- **TanStack Query** — set `tanstackQuery: true` in `source.ts` **and** add `<apiRoot>/query-scope.ts`.
- **Zod** — wrap a schema with `createZodValidator` from `@openmirai/openapi-codegen/validation/zod` and pass it as `config.validateResponse`.

## Install

Requires **Node.js 20.11+** (LTS). Use any package manager.

| Package manager | Install |
| --- | --- |
| npm | `npm install --save-dev @openmirai/openapi-codegen` |
| pnpm | `pnpm add -D @openmirai/openapi-codegen` |
| yarn | `yarn add -D @openmirai/openapi-codegen` |
| bun | `bun add -d @openmirai/openapi-codegen` |

Axios is an **optional peer**. Install `axios` only if you use `--client axios`.

Add a script so every package manager resolves the CLI from `node_modules/.bin`:

```json
{
  "scripts": {
    "generate:types": "openapi-codegen generate --all"
  }
}
```

Then run `npm run generate:types`, `pnpm run generate:types`, `yarn generate:types`, or `bun run generate:types`.

## CLI usage

Prefer the `package.json` script above. To invoke the binary directly:

| Command | npm | pnpm | yarn | bun |
| --- | --- | --- | --- | --- |
| Init a source | `npx openapi-codegen init --source atlas --client axios` | `pnpm exec openapi-codegen init --source atlas --client axios` | `yarn openapi-codegen init --source atlas --client axios` | `bunx openapi-codegen init --source atlas --client axios` |
| Generate one source | `npx openapi-codegen generate --source atlas` | `pnpm exec openapi-codegen generate --source atlas` | `yarn openapi-codegen generate --source atlas` | `bunx openapi-codegen generate --source atlas` |
| Generate all sources | `npx openapi-codegen generate --all` | `pnpm exec openapi-codegen generate --all` | `yarn openapi-codegen generate --all` | `bunx openapi-codegen generate --all` |
| Drift check (CI) | `npx openapi-codegen generate --all --check` | `pnpm exec openapi-codegen generate --all --check` | `yarn openapi-codegen generate --all --check` | `bunx openapi-codegen generate --all --check` |

| Subcommand | Purpose |
| --- | --- |
| `init` | Scaffold `http.ts`, `source.ts`, `known-types.ts` |
| `generate` | Write generated files |
| `check` | Same as `generate --check` — exit 1 if output would change |
| `accept-base` | Update generated `base.ts` (`base.d.ts` for split declaration output) and patch `models.ts` `BaseResponse` |

`--check` and `--accept-base` cannot be combined. See [docs/cli.md](docs/cli.md) for the full command reference.

## How the flow works

```text
init  →  source.ts + http.ts  →  resolve spec  →  generate  →  typed callers
```

### 1. Init a source

```bash
openapi-codegen init --source atlas --client axios
openapi-codegen init --source orbit --client fetch --layout packages
```

`--client` is `axios` | `fetch` | `custom`. `--layout` is `monolith` (default, `apiRoot` = `src/api`) or `packages` (`apiRoot` = `packages/utils/src/api`).

Init creates (if missing):

- `openapi-codegen.json` with `apiRoot`
- `<apiRoot>/http.ts` — your `HTTPFetch` implementation
- `<apiRoot>/known-types.ts` — optional schema → local type mapping
- `<apiRoot>/<source>/source.ts` — per-API config (type-safe template)
- `<apiRoot>/<source>/generated/` directory

Existing files are skipped.

### 2. Configure `source.ts`

Use `defineSourceConfig` for autocomplete and compile-time checks:

```ts
import { defineSourceConfig } from "@openmirai/openapi-codegen";

export default defineSourceConfig({
  spec: "./specs/acme.json",
  functionsDir: "packages/utils/src/api/routes/atlas",
  typesDir: "packages/types/src/api/atlas",
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  routeEnumName: "RouteTargets",
  generationMode: "authoritative",
  naming: "path",
  ignorePaths: [],
  maxRenderDepth: 50,
  resolveMapKeyRefs: true,
  tanstackQuery: false,
  queryExtends: {
    page: "page",
    limit: "limit",
    sortBy: "sortBy",
    sortOrder: "sortOrder",
    paginationTypeName: "OffsetLimitQuery",
    paginationImportPath: "./pagination",
    sortTypeName: "SortParams",
    sortImportPath: "./pagination",
  },
});
```

Plain `export default { ... }` still works; the CLI reads config fields from the file at generate time.

Re-exported types from the package root:

- `SourceConfig`, `QueryExtendsConfig`, `GenerationMode`, `NamingStrategy`
- `defineSourceConfig(config)` — identity helper for typed `source.ts`

| Field | Meaning |
| --- | --- |
| `spec` | Project-relative spec path (used when no `--spec` / env override) |
| `functionsDir` | Project-relative function output directory (defaults to the source's `generated/functions`) |
| `typesDir` | Project-relative type output directory (defaults to the source's `generated/types`; a generated `base.d.ts` is placed beside this directory when customized) |
| `pathPrefix` | Only generate operations under this prefix (e.g. `/api/acme/v3`) |
| `ignorePaths` | Extra paths to skip |
| `stripApiPrefix` | Strip a leading `/api` segment from route enum member names |
| `routeEnumName` | Enum name (default `RouteTargets`) |
| `generationMode` | `authoritative` (overwrite routes) or `merge` (keep extra enum members) |
| `naming` | `path` or `operationId` for function names |
| `queryExtends` | Fold page/limit/sort query params into shared pagination types |
| `tanstackQuery` | Emit Query helpers when `query-scope.ts` exists |
| `importBase` | Force import prefix for generated function files (overrides tsconfig aliases) |
| `maxRenderDepth` / `resolveMapKeyRefs` | Schema renderer limits |

### 3. Spec resolution (first match wins)

1. `--spec <path>`
2. Env `OPENAPI_SPEC_<KEY>` — source key uppercased, hyphens → underscores
3. `spec` in that source’s `source.ts`
4. `openapi-codegen.local.json` (gitignored) map of `{ "<source>": "<path>" }`
5. Committed snapshot `<apiRoot>/<source>/spec.json`

### 4. Envelope modes

Inferred from success response schemas. Details: [docs/envelope.md](docs/envelope.md).

| Mode | When | Types |
| --- | --- | --- |
| **shared** | One envelope shape (`data` / `success` / `message`) | `BaseResponse<Unwrapped>` |
| **raw** | No shared envelope | Spec schema as-is |
| **mixed** | Some ops have `data`, others do not | Unwrap **per operation** when `data` exists |

### 5. HTTPFetch (`http.ts`)

Adapters implement `HTTPFetch` from `@openmirai/openapi-codegen/http` (or the axios/fetch adapter packages). Methods return `Promise<{ data: TResponse }>`.

- If `http.ts` **exports `httpFetch`**, generated functions call that singleton.
- Otherwise they take `props.http: HTTPFetch` (injected).

### 6. Path-alias aware imports

Generated function files import types and `runtime`, and generated response
types import the generated base declaration (`base.ts` in monolith output, or
`base.d.ts` for split declaration output), using:

1. `importBase` in `source.ts`, if set
2. Else `compilerOptions.paths` from the nearest ancestor `tsconfig.json` with path aliases, starting at the corresponding `functionsDir` or `typesDir`
3. Else relative paths (`../../runtime`)

## Where files go

`openapi-codegen.json`:

```json
{ "apiRoot": "packages/utils/src/api" }
```

You can also set `"openapiCodegen": { "apiRoot": "..." }` in `package.json`. The JSON file wins.

**Monolith** (`--layout monolith`, default):

```text
src/api/http.ts
src/api/known-types.ts
src/api/models.ts                 # optional BaseResponse drift check
src/api/query-scope.ts            # optional TanStack
src/api/atlas/source.ts
src/api/atlas/spec.json           # optional snapshot
src/api/atlas/generated/…
```

**Packages layout** (`--layout packages`): typical placement is `packages/utils/src/api/<source>/`.

Set `functionsDir` and `typesDir` when callers and declarations belong in
different packages. Relative imports continue to work without aliases; when a
nearby `tsconfig.json` maps both output roots, deep generated imports use those
aliases automatically.

## Zod (optional)

```ts
import { createZodValidator } from "@openmirai/openapi-codegen/validation/zod";
import { widgetListSchema } from "./widget-list";

await getWidgets({
  params: { page: 1, limit: 20 },
  config: { validateResponse: createZodValidator(widgetListSchema) },
});
```

## Releasing

Publishes go through [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (GitHub Actions OIDC). Do not `npm publish` from a laptop.

| | Value |
| --- | --- |
| npm package | `@openmirai/openapi-codegen` |
| GitHub repo | `openmirai/mirai-openapi-codegen` |
| Workflow | `.github/workflows/publish.yml` |
| Tag | `v*` (e.g. `v0.1.3`) |

## Develop this repo

This repository uses **pnpm** for its own CI. Consumers are not required to use pnpm.

```bash
pnpm install
pnpm verify   # format, lint, typecheck, build, coverage
```

Test layout: [test/README.md](test/README.md).
