# @openmirai/openapi-codegen

Headless **OpenAPI / Swagger → TypeScript** codegen. The CLI is `openapi-codegen`. It reads a spec, writes typed route enums, request types, and HTTP caller functions, and never talks to a network.

- **npm package:** `@openmirai/openapi-codegen`
- **GitHub:** [openmirai/mirai-openapi-codegen](https://github.com/openmirai/mirai-openapi-codegen) (not `openmirai/openapi-codegen`)

This is a library plus a CLI. You own `http.ts` (the `HTTPFetch` adapter). Generated files import that adapter — they do not invent axios/fetch calls inline.

## What it generates

For each **source** (a named API, e.g. `atlas`), under `<apiRoot>/<source>/generated/`:

| Output | Role |
| --- | --- |
| `types/**/*.d.ts` | Params, body, and response types per operation |
| `functions/**/*.ts` | Typed callers (`getWidgets`, …) |
| `routes.ts` | `Routes` string map + `RouteTargets` enum (name configurable) |
| `runtime.ts` | Re-exports `HTTPFetch`, `httpFetch` (if singleton), routes |
| `base.ts` | `BaseResponse<T>` when the spec uses a response envelope |

Optional:

- **TanStack Query** — set `tanstackQuery: true` in `source.ts` **and** add `<apiRoot>/query-scope.ts`. GET callers then emit `queryOptions` helpers.
- **Zod** — not generated automatically. Wrap a schema with `createZodValidator` from `@openmirai/openapi-codegen/validation/zod` and pass it as `config.validateResponse`.

Generated callers use generics on `HTTPFetch` methods. They do not emit `as` casts.

## Install

Requires **Node.js 24** (engines: `>=24 <25`) and **pnpm 10+**.

Published package:

```bash
pnpm add -D @openmirai/openapi-codegen
```

OpenMirai frontend monorepo (`fe-mirai-org-turbo`): pin the npm tarball in the workspace **catalog** the same way other `@openmirai/*` packages are pinned, then depend on `catalog:` — do not confuse the **package name** with the **GitHub repo name**.

Local checkout (this repo next to the app):

```bash
pnpm add -D @openmirai/openapi-codegen@file:../openmirai-openapi-codegen
```

Axios is an **optional peer**. Install `axios` only if you use `--client axios`.

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
- `<apiRoot>/<source>/source.ts` — per-API config
- `<apiRoot>/<source>/generated/` directory

Existing files are skipped.

### 2. Configure `source.ts`

Init writes a template. Synthetic defaults used in this repo’s tests:

```ts
export default {
  spec: "./specs/acme.json",
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  routeEnumName: "RouteTargets",
  generationMode: "authoritative" as const,
  naming: "path" as const,
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
};
```

| Field | Meaning |
| --- | --- |
| `spec` | Project-relative spec path (used when no `--spec` / env override) |
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
2. Env `OPENAPI_SPEC_<KEY>` — source key uppercased, hyphens → underscores (`atlas` → `OPENAPI_SPEC_ATLAS`, `core-v2` → `OPENAPI_SPEC_CORE_V2`)
3. `spec` in that source’s `source.ts`
4. `openapi-codegen.local.json` (gitignored) map of `{ "<source>": "<path>" }`
5. Committed snapshot `<apiRoot>/<source>/spec.json`

### 4. Generate

```bash
openapi-codegen generate --source atlas
openapi-codegen generate --source atlas --source orbit
openapi-codegen generate --all
```

`--all` walks every directory under `apiRoot` that contains `source.ts`.

### 5. Envelope modes

Inferred from success response schemas. Details: [docs/envelope.md](docs/envelope.md).

| Mode | When | Types |
| --- | --- | --- |
| **shared** | One envelope shape (fields like `data` / `success` / `message`) | `BaseResponse<Unwrapped>` |
| **raw** | No shared envelope | Spec schema as-is |
| **mixed** | Some ops have `data`, others do not | Unwrap **per operation** when `data` exists |

Mixed example (`test/fixtures/specs/mixed-envelope.json`): `GET /api/acme/v3/widgets` unwraps `data`; `GET /api/acme/v3/plain/{token}` stays a plain `{ token, caption }` object.

### 6. HTTPFetch (`http.ts`)

Adapters implement `HTTPFetch` from `@openmirai/openapi-codegen/http` (or the axios/fetch adapter packages). Methods return `Promise<{ data: TResponse }>`.

- If `http.ts` **exports `httpFetch`**, generated functions call that singleton.
- Otherwise they take `props.http: HTTPFetch` (injected).

Axios template from init:

```ts
import axiosBase from "axios";
import { createAxiosAdapter } from "@openmirai/openapi-codegen/adapters/axios";

const axios = axiosBase.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

export const httpFetch = createAxiosAdapter(axios);
```

### 7. Path-alias aware imports

Function files import types and `runtime` using:

1. `importBase` in `source.ts`, if set
2. Else `compilerOptions.paths` from the nearest `tsconfig.json`
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

**Packages / OpenMirai** (`--layout packages`): typical placement is `packages/utils/src/api/<source>/` (same layout under that `apiRoot`).

## Commands

```bash
openapi-codegen init --source <key> --client axios|fetch|custom [--layout monolith|packages]
openapi-codegen generate --source <key> [--source <key2> …] [--spec <path>] [--check] [--accept-base]
openapi-codegen generate --all [--check] [--accept-base]
openapi-codegen check --source <key> [--spec <path>]
openapi-codegen accept-base --source <key> [--spec <path>]
```

| Command | Behavior |
| --- | --- |
| `generate` | Write generated files |
| `check` / `generate --check` | Exit 1 if generated files would change (CI drift) |
| `accept-base` | Update `generated/base.ts` and patch `models.ts` `BaseResponse` to the spec |

`--check` and `--accept-base` cannot be combined.

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

Publishes go through [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (GitHub Actions OIDC on `ubuntu-latest`). Do not `npm publish` from a laptop.

| | Value |
| --- | --- |
| npm package | `@openmirai/openapi-codegen` |
| GitHub repo | `openmirai/mirai-openapi-codegen` |
| Workflow | `.github/workflows/publish.yml` |
| Tag | `v*` (e.g. `v0.1.2`) |

1. Land the version in `package.json` on `main`.
2. Create the annotated tag with **release-it** (this repo: `pnpm release`, npm publish disabled locally). Use `--no-increment` when the version is already bumped.
3. Tag push (or `workflow_dispatch` on `publish.yml`) runs verify, `npm publish`, and creates the GitHub Release.

Trusted Publisher on npm must target repo `mirai-openapi-codegen`, workflow file `publish.yml`, permission `publish`.

## Develop this repo

```bash
pnpm install
pnpm verify   # format, lint, typecheck, build, coverage
```

Test layout: [test/README.md](test/README.md).
