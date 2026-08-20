# @openmirai/openapi-codegen

Headless TypeScript code generator for OpenAPI / Swagger specs. Produces typed route enums, request-parameter interfaces, and HTTP caller functions for any OpenAPI 2/3 spec.

## Usage

```bash
# Initialize HTTP adapter file and source config
openapi-codegen init --source atlas --client axios
openapi-codegen init --source orbit --client fetch

# Generate types and callers (spec path via CLI flag)
openapi-codegen generate --source atlas --spec ./swagger.json

# Check for drift without writing files (CI)
openapi-codegen check --source atlas --spec ./swagger.json
```

## Multi-source generate

Configure the spec path in each `source.ts` so no per-invocation `--spec` flag is needed:

```ts
// src/api/core-v2/source.ts
export default {
  spec: "../mirai-core-api/cmd/admin/docs/swagger.json",
  // ...other options
};
```

Then generate all sources in one command:

```bash
# All sources under apiRoot (reads spec from each source.ts)
openapi-codegen generate --all

# Selected sources only
openapi-codegen generate --source core-v2 --source central-v2
```

### Spec resolution order (per source)

1. `--spec` CLI flag
2. `OPENAPI_SPEC_<UPPER_KEY>` environment variable
3. `spec` field in `source.ts`
4. `openapi-codegen.local.json` (gitignored per-machine override)
5. Committed snapshot at `<sourceDir>/spec.json`

## Full spec

See the [plan document](https://github.com/openmirai/mirai-openapi-codegen) for the complete architecture, envelope safety rules, test suite layout, and adoption guide.

## Releasing

Publishes go through [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (GitHub Actions OIDC). Do not run `pnpm release` or `npm publish` locally with OTP.

1. Land the version bump on `main` (`package.json` version, e.g. `0.1.1`).
2. Push an annotated tag: `git tag -a v0.1.1 -m "v0.1.1" && git push origin v0.1.1`
3. Workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) verifies, publishes `@openmirai/openapi-codegen`, and creates the GitHub Release.

### One-time npm Trusted Publisher settings

On [the package access page](https://www.npmjs.com/package/@openmirai/openapi-codegen/access), add a GitHub Actions trusted publisher:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `openmirai` |
| Repository | `mirai-openapi-codegen` |
| Workflow filename | `publish.yml` |
| Environment | *(leave empty)* |
| Allowed actions | `npm publish` |

The GitHub remote is `https://github.com/openmirai/mirai-openapi-codegen.git` (not `openapi-codegen`). Publish jobs must use GitHub-hosted runners (`ubuntu-latest`); CodeBuild/self-hosted runners cannot mint the npm OIDC token.
