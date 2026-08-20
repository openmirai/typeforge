# Test layout

Usage and layout for consumers: [README.md](../README.md). Envelope classification: [docs/envelope.md](../docs/envelope.md).

## Structure

- **Unit tests** live in `src/**/__tests__/*.test.ts` next to the module they cover.
- **Integration tests** live in `test/integration/` and exercise `generateForSource()` against temp project trees.
- **E2E tests** live in `test/e2e/` and spawn the built `dist/cli.js` binary.
- **Fixtures** live in `test/fixtures/specs/` (OpenAPI JSON) and `test/fixtures/layouts/` (ephemeral temp dirs created during tests).

## Conventions

1. Prefer `createMonolithProject()` from `test/helpers/project.ts` for integration setup.
2. Always clean temp dirs in `afterEach` — never commit `test/fixtures/layouts/*` run output.
3. Use `NO_COLOR=1` in CLI subprocess tests for stable assertions.
4. Assert behavior and output shape, not full golden files, unless adding a snapshot is intentional.
5. Run `pnpm verify` before pushing; it includes the coverage gate (`pnpm test:coverage`).

## Commands

```bash
pnpm test              # all unit + integration + e2e
pnpm test:coverage     # coverage with auto-updated thresholds in vitest.config.ts
pnpm verify            # format + lint + typecheck + build + test
```
