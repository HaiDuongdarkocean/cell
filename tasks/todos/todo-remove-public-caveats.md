# TODO: Remove public-repo caveats

## Phase 1: Prepare data externalization

- [ ] 1.1 Inventory large runtime/test/showcase assets
- [ ] 1.2 Choose asset hosting (`cell-assets` repo vs. Google Drive)
- [ ] 1.3 Design `data/assets.json` manifest schema
- [ ] 1.4 Write `scripts/download-data.mjs`

## Phase 2: Remove large data from Git history

- [ ] 2.1 Back up current `main` and all tags to `pre-data-cleanup`
- [ ] 2.2 Rewrite history with `git-filter-repo` to purge externalized paths
- [ ] 2.3 Re-add `origin` and force-push cleaned `main`
- [ ] 2.4 Upload data to asset host and generate `data/assets.json`

## Phase 3: Wire data download into build

- [ ] 3.1 Add `npm run download-data` to `package.json`
- [ ] 3.2 Make `prebuild` depend on data presence
- [ ] 3.3 Update `scripts/ship-dist.ps1`
- [ ] 3.4 Update `README.md` and ADR

## Phase 4: Remove AI tooling from public tree

- [ ] 4.1 Create private `cell-ai-tools` repository
- [ ] 4.2 Write vendor-neutral public `AGENTS.md`
- [ ] 4.3 Add `.gitignore` for private overlay folders
- [ ] 4.4 Write `tools/overlay-ai-tools.ps1`
- [ ] 4.5 Rewrite history to strip `.devin/`, `.agents/`, `.continue/`
- [ ] 4.6 Force-push cleaned public `main`

## Phase 5: Re-release

- [ ] 5.1 Bump version to `0.1.2`
- [ ] 5.2 Run full pre-commit gate
- [ ] 5.3 Ship `v0.1.2`
- [ ] 5.4 Test install and update in Chrome
