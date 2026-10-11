<p align="center">
  <img src="https://raw.githubusercontent.com/openmirai/typeforge/HEAD/assets/typeforge-logo.png" alt="Typeforge logo" width="280" />
</p>

# @openmirai/typeforge

Headless **OpenAPI / Swagger → TypeScript** codegen. The CLI is `typeforge`. It reads a spec, writes typed route enums, request types, and HTTP caller functions, and never talks to a network.

- **npm:** [`@openmirai/typeforge`](https://www.npmjs.com/package/@openmirai/typeforge)
- **GitHub:** [openmirai/typeforge](https://github.com/openmirai/typeforge)

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
- **Zod** — wrap a schema with `createZodValidator` from `@openmirai/typeforge/validation/zod` and pass it as `config.validateResponse`.

## Install

Requires **Node.js 24+** (LTS). Use any package manager.

| Package manager | Install |
| --- | --- |
| npm | `npm install --save-dev @openmirai/typeforge` |
| pnpm | `pnpm add -D @openmirai/typeforge` |
| yarn | `yarn add -D @openmirai/typeforge` |
| bun | `bun add -d @openmirai/typeforge` |

Axios is an **optional peer**. Install `axios` only if you use `--client axios`.

Add a script so every package manager resolves the CLI from `node_modules/.bin`:

```json
{
  "scripts": {
    "generate:types": "typeforge generate --all"
  }
}
```

Then run `npm run generate:types`, `pnpm run generate:types`, `yarn generate:types`, or `bun run generate:types`.

## CLI usage

Prefer the `package.json` script above. To invoke the binary directly:

| Command | npm | pnpm | yarn | bun |
| --- | --- | --- | --- | --- |
| Init a source | `npx typeforge init --source atlas --client axios` | `pnpm exec typeforge init --source atlas --client axios` | `yarn typeforge init --source atlas --client axios` | `bunx typeforge init --source atlas --client axios` |
| Generate one source | `npx typeforge generate --source atlas` | `pnpm exec typeforge generate --source atlas` | `yarn typeforge generate --source atlas` | `bunx typeforge generate --source atlas` |
| Generate all sources | `npx typeforge generate --all` | `pnpm exec typeforge generate --all` | `yarn typeforge generate --all` | `bunx typeforge generate --all` |
| Drift check (CI) | `npx typeforge generate --all --check` | `pnpm exec typeforge generate --all --check` | `yarn typeforge generate --all --check` | `bunx typeforge generate --all --check` |

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
typeforge init --source atlas --client axios
typeforge init --source orbit --client fetch --layout packages
```

`--client` is `axios` | `fetch` | `custom`. `--layout` is `monolith` (default, `apiRoot` = `src/api`) or `packages` (`apiRoot` = `packages/utils/src/api`).

Init creates (if missing):

- `typeforge.json` with `apiRoot`
- `<apiRoot>/http.ts` — your `HTTPFetch` implementation
- `<apiRoot>/known-types.ts` — optional schema → local type mapping
- `<apiRoot>/<source>/source.ts` — per-API config (type-safe template)
- `<apiRoot>/<source>/generated/` directory

Existing files are skipped.

### 2. Configure `source.ts`

Use `defineSourceConfig` for autocomplete and compile-time checks:

```ts
import { defineSourceConfig } from "@openmirai/typeforge";

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
| `unwrapResponseData` | Emit an envelope's `data` schema as the operation response type when the project's `HTTPFetch` already unwraps envelopes |

### 3. Spec resolution (first match wins)

1. `--spec <path>`
2. Env `OPENAPI_SPEC_<KEY>` — source key uppercased, hyphens → underscores
3. `spec` in that source’s `source.ts`
4. `typeforge.local.json` (gitignored) map of `{ "<source>": "<path>" }`
5. Committed snapshot `<apiRoot>/<source>/spec.json`

### 4. Envelope modes

Inferred from success response schemas. Details: [docs/envelope.md](docs/envelope.md).

| Mode | When | Types |
| --- | --- | --- |
| **shared** | One envelope shape (`data` / `success` / `message`) | `BaseResponse<Unwrapped>` |
| **raw** | No shared envelope | Spec schema as-is |
| **mixed** | Some ops have `data`, others do not | Unwrap **per operation** when `data` exists |

Set `unwrapResponseData: true` when the project's injected `HTTPFetch`
normalizes successful envelope bodies before returning `{ data }`. Every
operation whose success schema is recognized as an API envelope then receives
its `data` payload type. Data-only objects and business payloads that also
contain `success` remain raw. Metadata-only envelopes without a `data` field
receive the `null` type,
matching clients that normalize an omitted payload to `null`.
The default remains envelope-preserving and is compatible with the bundled
Axios and Fetch adapters.

### 5. HTTPFetch (`http.ts`)

Adapters implement `HTTPFetch` from `@openmirai/typeforge/http` (or the axios/fetch adapter packages). Methods return `Promise<{ data: TResponse }>`.

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

`typeforge.json`:

```json
{ "apiRoot": "packages/utils/src/api" }
```

You can also set `"typeforge": { "apiRoot": "..." }` in `package.json`. The JSON file wins.

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
import { createZodValidator } from "@openmirai/typeforge/validation/zod";
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
| npm package | `@openmirai/typeforge` |
| GitHub repo | `openmirai/typeforge` |
| Workflow | `.github/workflows/publish.yml` |
| Tag | `v*` (e.g. `v0.1.3`) |

## Develop this repo

This repository uses **pnpm** for its own CI. Consumers are not required to use pnpm.

```bash
pnpm install
pnpm verify   # format, lint, typecheck, build, coverage
```

Test layout: [test/README.md](test/README.md).

## Pinned Git specs and drift

`spec` still accepts a project-relative file path or HTTP(S) URL. For a pinned
producer, configure a local checkout or bare repository (no sibling layout required):

```ts
export default defineSourceConfig({
  spec: {
    repository: "${API_REPOSITORY}",
    commit: "0123456789abcdef0123456789abcdef01234567",
    path: "docs/openapi.json",
  },
  generationMode: "authoritative",
});
```

Set `API_REPOSITORY` to an absolute repository path on each machine; a literal
project-relative or absolute path also works. Use a full commit object ID, never
a branch, tag or abbreviated revision. Typeforge reads the commit's blob without
consulting the working tree, following replacement objects, fetching or checking out.
The repository must already contain the commit, including in CI.

- `typeforge update --source api`: explicitly accept the configured Git revision,
  validate and generate, then write `spec.json` and `typeforge.provenance.json`.
- `typeforge generate --source api`: verify the configured source and raw/canonical
  SHA-256 hashes against the receipt and generate from that exact commit. This can
  repair the local snapshot, but cannot silently accept a different source revision.
- `typeforge generate --all --check` (or `typeforge check --source api`): report
  spec, provenance and output drift, exiting nonzero without creating directories,
  writing, updating receipts or deleting files. `--accept-base` and `update` cannot
  be combined with `--check`, including through the programmatic API.

Review and commit the source configuration, snapshot, receipt and generated files
when accepting a revision. The hashes verify content integrity against the configured
Git object; they are not signatures or a trust decision about the producer. Git sources
reject `--spec` and `OPENAPI_SPEC_*` overrides so they cannot bypass provenance.
Existing string sources retain their CLI/environment/local override resolution.

Ownership is recorded in one comment on each generated file, with its source identity
and content hash. **No inventory, barrel or index file is created.** Authoritative
mode scans the configured output locations and removes only obsolete files marked
for that source whose contents still match their marker. Handwritten files and other
sources' outputs are preserved. Edited obsolete files and unowned output collisions
fail before writes; review them explicitly instead of losing manual changes.
Merge mode retains obsolete endpoint files and existing extra route entries.

On upgrading an existing project, generate once against its existing spec to adopt
legacy outputs identified by Typeforge’s exact generated banner and endpoint path,
or byte-identical outputs. A check reports the missing markers until then. Files
that are already obsolete and have no ownership marker cannot safely be attributed
to Typeforge; review those once manually. If moving output directories, clean the old
owned outputs before changing their locations. Removing ownership markers relinquishes
ownership; Typeforge never guesses from a filename or extension.

Acquisition, validation, envelope acceptance and rendering finish for every selected
source before any writes. Ordinary write errors roll back changed content and newly
created directories. This is not a crash-recovery journal or a concurrent-writer lock;
run one writer at a time. Checks only read, including on failure.

## Releasing

After owner approval, release from a clean `main` checkout containing the reviewed
changes and tracking `origin/main`. Use the pinned Node/pnpm configuration and run:

```sh
rtk pnpm install --frozen-lockfile
rtk pnpm verify
rtk pnpm release minor --dry-run
rtk pnpm release minor
```

Choose `patch`, `minor` or `major` for the approved scope. Let release-it update the
version, create the release commit/tag and push them; do not pre-bump the manifest
or manually create the release tag. The tag triggers the existing publish workflow,
which verifies the package, publishes through npm Trusted Publishing and creates
the GitHub release. Confirm workflow success and npm version, integrity and `gitHead`
before updating consumers.

If a version was already published or partially released, first reconcile the exact
commit, tag and registry state. Use release-it's documented
[`--no-increment` recovery](https://github.com/release-it/release-it#update-or-re-run-existing-releases)
for that existing version. Preserve published tags and package contents.
