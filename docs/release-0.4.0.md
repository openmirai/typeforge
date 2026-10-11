# Typeforge 0.4.0 — release review

Status: prepared locally, awaiting owner review before publication. No release tag,
push, registry publication or GitHub release has been created. npm currently reports
0.3.2; 0.4.0 is a minor release for the Git source API and stricter drift/ownership
behavior. Existing local-file and URL source configuration remains supported.

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

Constellation migration is prepared with the unchanged approved producer revision.
It passed typecheck, API generation/check, build and seven tests including real local
Gin/Vite. The temporary tarball has been removed at owner request; review uses an
ignored local dependency link. Its registry lockfile must be updated from actual npm
metadata after publication, then frozen-install verification repeated. No fake registry
integrity or consumer wrapper is committed.

## Publication boundary

Do not run `pnpm release` before owner review: the existing release-it configuration
pushes by default. The existing publish workflow runs on version tags and uses npm
Trusted Publishing. After explicit approval, use the repository release pipeline,
confirm registry 0.4.0 metadata, update Constellation's dependency lockfile, and repeat
frozen install plus native generation/check and consumer verification. Constellation's
next delivery gate stays held throughout.

Git commits must already exist locally. Historical obsolete files without ownership
markers need one-time review; old output locations must remain configured until
cleanup. Content hashes are integrity checks, not signatures. Concurrent writers and
crash/power-loss atomicity are not supported by this change.
