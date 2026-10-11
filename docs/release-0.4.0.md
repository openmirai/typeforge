# Typeforge 0.4.0 — release review

Status: published after owner approval on 11 October 2026. The initial release
incorrectly used a manual tag/push instead of the repository's `pnpm release`
entry point. The correction uses release-it's `--no-increment` recovery on `main`,
preserving the published package and tag rather than rewriting release history.
0.4.0 is a minor release for the Git source API and stricter drift/ownership behavior.
Existing local-file and URL source configuration remains supported.

- Published tag and npm `gitHead`: `a12e40c07a72f3bdcec7c687d46cf23f977132b8`.
- [Release](https://github.com/openmirai/typeforge/releases/tag/v0.4.0).
- [Successful verification and Trusted Publishing workflow](https://github.com/openmirai/typeforge/actions/runs/38122471838).

## Changes to review

- `spec` accepts `{ repository, commit, path }`; `repository` can be a path or a whole
  `${ENV_VAR}` reference. Git reads are tied to a full commit ID and ignore dirty
  working trees and replacement objects. No implicit fetch, checkout or moving refs.
- `typeforge update` explicitly accepts a configured revision and writes the local
  snapshot plus source/hash receipt. Ordinary generate/check cannot change provenance.
- Ownership is stored inside generated files as a source/hash comment. No inventory
  or generated index files. Authoritative generation removes obsolete owned outputs;
  handwritten files, other owners and merge-mode outputs are preserved. Edited obsolete
  files require review. Exact legacy Typeforge banners support existing consumers.
- Checks are read-only, including missing directories and failures. All selected
  sources are prepared before writes; envelope acceptance also waits for generation.
- 21 focused regressions cover exact commits, dirty/bare repositories, replacement
  objects, hashes, missing commits, explicit updates, removed/renamed endpoints,
  split layouts, handwritten files, read-only checks, generation failure and rollback.

## Verification and compatibility

327 tests across 57 files pass. Coverage: 96.12% lines, 89.96% branches,
99.62% functions; configured thresholds pass. Typecheck, lint (existing warnings),
format, build and package validation pass. Commit hooks run normally.

Turbo remains on Typeforge 0.2.0: its current check passes for 1,127 files. The new
source reads its unchanged config with zero ownership conflicts; adopting markers
and newer 0.3.2 emitter documentation requires a normal generation. The inspected
dashboard checkout uses a custom generator. Neither repository was changed.

Constellation migration is committed locally at `dc33ef3` with the unchanged approved
producer revision. Its lockfile resolves published registry 0.4.0. Frozen installation,
typecheck, API generation/check, build and seven tests including real local Gin/Vite
pass. A fresh isolated copy also passed frozen installation and successful/failing
read-only checks. No temporary tarball, source dependency link or consumer wrapper
is required.

## Publication boundary

For future releases, follow the [normal release procedure](../README.md#releasing).
The existing release-it configuration pushes by default. The publish workflow runs
on version tags and uses npm Trusted Publishing. An existing published version is
recovered with `rtk pnpm release --no-increment --ci`; do not delete or recreate its
tag, unpublish it, or bump a new version merely to repair release bookkeeping.
Constellation's next delivery gate stays held throughout.

Git commits must already exist locally. Historical obsolete files without ownership
markers need one-time review; old output locations must remain configured until
cleanup. Content hashes are integrity checks, not signatures. Concurrent writers and
crash/power-loss atomicity are not supported by this change.
