# Plan: Remove remaining public-repo caveats

## Overview

The `cell` repository is now public, has a clean history, and ships `v0.1.1`. Two caveats remain from the audit:

1. **Clone size:** `main` is ~263 MB because dictionary/model/ffmpeg/showcase data are committed as Git blobs.
2. **AI tooling in public tree:** `.devin/`, `.agents/`, `.continue/`, and vendor-specific `AGENTS.md` references are still tracked in the public repository.

This plan removes both caveats while keeping the project buildable, installable, and the maintainer's AI workflow intact.

## Supreme constraints

- Project must still build, test, and ship with `npm run build` and `npm run ship:dist`.
- AI workflow (skills, `AGENTS.md`, tool rules) must continue to work for the maintainer.
- No private keys or credentials may ever be committed.
- Every phase has a rollback path.

## Architecture decisions

1. **Data is externalized, not deleted.**
   - Large runtime assets (`data/resource/`, `public/models/`, `public/ffmpeg/`, design-system showcase videos) move to a companion `cell-assets` GitHub repository.
   - The source repo stores only a manifest (`data/assets.json`) and a downloader (`scripts/download-data.mjs`).
   - `npm run build` automatically downloads missing assets before Vite runs.
   - The shipped `.crx` still bundles the data; end users see no difference.

2. **AI tooling becomes a private overlay.**
   - Create a private `cell-ai-tools` repository that contains `.devin/`, `.agents/`, `.continue/`, and the maintainer-specific `AGENTS.md`.
   - The public `cell` repo removes these folders and uses a minimal, vendor-neutral `AGENTS.md`.
   - The maintainer overlays the private tooling with a sync script (`tools/overlay-ai-tools.ps1`) that creates temporary junctions/symlinks or copies files into the working tree before an AI session, and cleans them afterward.
   - CI and public clone never see the AI tooling.

3. **Release after cleanup.**
   - A cleanup of this scale rewrites `main` again, so `v0.1.1` will no longer point to the current history.
   - After cleanup, cut `v0.1.2` and update `updates.xml`.
   - `v0.1.1` is left untouched as a rollback release.

## Task list

### Phase 1: Prepare data externalization

- [ ] **Task 1.1:** Inventory all large runtime/test/showcase assets and group them by purpose.
  - Files: `data/resource/**`, `public/models/*`, `public/ffmpeg/*.wasm`, `src/entrypoints/design-system-showcase/assets/*.mp4`, `tests/data-test/**/*.mp4`.
  - Acceptance: A complete list with sizes and consumers.

- [ ] **Task 1.2:** Choose asset hosting.
  - Option A: `HaiDuongdarkocean/cell-assets` GitHub repo with release assets.
  - Option B: Google Drive public folder (manual share link).
  - Acceptance: Decision recorded in ADR; the maintainer approves the host.

- [ ] **Task 1.3:** Design `data/assets.json` manifest schema.
  - Fields: `path` (relative to repo root), `url`, `sha256`, `size`, `optional`.
  - Acceptance: Schema is documented and can be validated by a script.

- [ ] **Task 1.4:** Write `scripts/download-data.mjs`.
  - Reads `data/assets.json`, downloads missing or corrupted files, verifies `sha256`, resumes partial downloads.
  - Acceptance: Running the script on a fresh clone produces an identical working tree for `data/` and `public/`.

### Phase 2: Remove large data from Git history

- [ ] **Task 2.1:** Back up current `main` and all tags.
  - Push `main` to a `pre-data-cleanup` branch on origin and keep local copy.
  - Acceptance: A full restore is possible without rebuilding from scratch.

- [ ] **Task 2.2:** Rewrite history to purge large blobs.
  - Use `git-filter-repo` to remove the externalized paths from every commit.
  - Add the externalized paths to `.gitignore`.
  - Acceptance: `git count-objects -vH` shows a pack under ~30 MB; `git ls-tree -r HEAD` no longer contains the large files.

- [ ] **Task 2.3:** Re-add `origin` and force-push cleaned `main`.
  - Acceptance: `git log --all` is linear and old large blobs are not reachable.

- [ ] **Task 2.4:** Upload data to the chosen asset host.
  - Package the removed files into `cell-data-v1.zip` and publish a release in `cell-assets`.
  - Generate `data/assets.json` pointing to the release URL.
  - Acceptance: `scripts/download-data.mjs` can populate a fresh clone.

### Phase 3: Wire data download into build

- [ ] **Task 3.1:** Add `npm run download-data` script.
  - `package.json` script runs `node scripts/download-data.mjs`.
  - Acceptance: `npm run download-data` succeeds on a clean clone.

- [ ] **Task 3.2:** Make `npm run build` depend on data presence.
  - Update `prebuild` to run `download-data` if needed, or fail with a helpful message if offline.
  - Acceptance: `npm ci && npm run build` succeeds on a fresh clone with internet.

- [ ] **Task 3.3:** Update `ship-dist.ps1`.
  - Ensure the script runs `npm run build` (which will download data) before packing.
  - Acceptance: `npm run ship:dist` still produces a valid `cell.crx` and `updates.xml`.

- [ ] **Task 3.4:** Update `README.md` and ADR.
  - Document the `npm run download-data` step and the first-time clone process.
  - Acceptance: A new contributor can follow README and build the extension.

### Phase 4: Remove AI tooling from public tree

- [ ] **Task 4.1:** Create a private `cell-ai-tools` repository.
  - Move `.devin/`, `.agents/`, `.continue/`, and the current `AGENTS.md` into it.
  - Acceptance: The private repo is not public, and the maintainer can clone it.

- [ ] **Task 4.2:** Write a minimal, vendor-neutral public `AGENTS.md`.
  - Contains only project facts (name, build commands, no skill routing, no vendor names).
  - Acceptance: The public file has no `.devin`, `.agents`, `Windsurf`, `Devin`, or `Claude` references.

- [ ] **Task 4.3:** Add `.gitignore` for private overlay folders.
  - Ignore `.devin/`, `.agents/`, `.continue/`, `AGENTS.md` in the public `cell` repo.
  - Acceptance: `git status` stays clean even when the overlay is present locally.

- [ ] **Task 4.4:** Write `tools/overlay-ai-tools.ps1`.
  - Pulls `cell-ai-tools` into a `tools/ai-tools/` subfolder.
  - Optionally creates junctions/symlinks (or copies) into the repo root before an AI session.
  - Restores the public state after the session.
  - Acceptance: Running the script before an AI session gives the agent the same skill context as before; running it with `-Restore` leaves the public tree clean.

- [ ] **Task 4.5:** Rewrite history to remove AI tooling from public history.
  - Use `git-filter-repo` to strip `.devin/`, `.agents/`, `.continue/`, and the old `AGENTS.md` from every commit.
  - Acceptance: `git log --all -S ".agents/skills"` and `git log --all -S ".devin"` return nothing.

- [ ] **Task 4.6:** Force-push cleaned public `main`.
  - Acceptance: GitHub public tree has no AI tool folders.

### Phase 5: Re-release

- [ ] **Task 5.1:** Bump version to `0.1.2`.
  - Update `package.json` and any version strings.
  - Acceptance: `package.json` version is `0.1.2`.

- [ ] **Task 5.2:** Run the full pre-commit gate.
  - `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run build`, `npm audit --json`.
  - Acceptance: All pass.

- [ ] **Task 5.3:** Ship `v0.1.2`.
  - `npm run build && npm run ship:dist`.
  - Verify extension ID and `update_url` inside the `.crx`.
  - Acceptance: `v0.1.2` release has `cell.crx` and `updates.xml`; `updates.xml` points to the `v0.1.2` asset.

- [ ] **Task 5.4:** Test install and update in Chrome.
  - Install the old `v0.1.1` `.crx`, then press Update and verify it updates to `v0.1.2`.
  - Acceptance: Chrome installs and updates correctly.

## Checkpoints

### Checkpoint A: After Task 2.2
- [ ] Fresh clone with `--depth=1` is under 30 MB.
- [ ] `git fsck --full --no-reflogs` is clean.

### Checkpoint B: After Task 3.4
- [ ] `npm ci && npm run build` succeeds on a fresh clone.
- [ ] `npm run test:unit` passes.

### Checkpoint C: After Task 4.6
- [ ] GitHub public tree has no `.devin/`, `.agents/`, `.continue/`.
- [ ] Local overlay script restores AI workflow.

### Checkpoint D: After Task 5.4
- [ ] `v0.1.2` release is live.
- [ ] Chrome update path works.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data download fails on slow/unmetered connections | High | Allow `npm run build` to fail gracefully; provide manual download instructions; cache data in `~/.cache/cell-assets`. |
| `cell-assets` release unavailable | High | Keep a local backup; mirror to Google Drive; pin manifest to multiple URLs. |
| AI tooling overlay breaks agent skill loading | High | Test overlay in a fresh clone; keep `cell-ai-tools` private but documented. |
| Rewriting history invalidates open branches/PRs | Medium | Only `main` is public; notify any collaborators; archive old `main` in `pre-cleanup` branch. |
| `v0.1.1` users cannot update | Medium | Keep `v0.1.1` release and ensure `v0.1.2` uses the same extension ID. |

## Open questions

- Which data assets must be in the source repo for tests (`tests/data-test/**/*.mp4`) vs. which are only for runtime?
- Should `cell-assets` be public (for open source contributors) or private (for maintainer only)?
- Is the maintainer comfortable with a private `cell-ai-tools` repo and an overlay script, or should we keep a public but vendor-neutral `AGENTS.md` only?
