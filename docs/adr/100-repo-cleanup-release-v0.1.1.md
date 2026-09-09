# ADR-100: Repository security/hygiene cleanup and v0.1.1 release

**Status:** Accepted  
**Date:** 2026-09-10  
**Author:** Cell team  

## Context

The Cell Chrome MV3 extension repository had grown to include:

- Untracked and tracked generated artifacts (`dist/`, `dist.zip`, `.crx`, `tokens.css`, design reports).
- Local-only private signing keys (`cell-key.pem`) left in the working directory.
- Temporary/debug files and unrelated local documents (e.g. Devin CLI shortcut cheatsheet, `.commit-msg.txt` with `Generated with [Devin]`).
- Large dictionary/media/model assets committed as normal Git blobs, producing a 265 MB+ pack and triggering GitHub LFS warnings.
- AI/vendor attribution in public commit messages and files.

The goal was to make the repository safe and reasonable for other people to clone, build, and install, while preserving the existing extension ID, update URL, and `npm run ship:dist` release pipeline.

## Decision

### 1. Keep the private signing key local only

- `cell-key.pem` is required by `scripts/ship-dist.ps1` to sign `.crx` builds.
- It is **never** committed. `.gitignore` contains `*-key.pem` and `*.crx`.
- The public extension ID is derived from the public key and remains stable as long as `cell-key.pem` is reused.

### 2. Rewrite history to remove generated files, unrelated artifacts, and AI attribution

- `git-filter-repo` was used to remove from history:
  - private key filenames (`cell-key.pem`, `ublock-key.pem`),
  - `.crx` files,
  - `dist.zip`/`dist.rar` archives,
  - design-system build assets,
  - debug logs (`cell-debug-log.json`, `ocr-csp-debug.json`),
  - `loop/` and `.commit-msg.txt`,
  - `Generated with [Devin](https://devin.ai)` signatures in commit messages.
- Public commit messages were also scanned; no remaining `Generated with [Devin]` messages exist.

### 3. Large data/runtime assets stay in the Git pack (no Git LFS)

- An attempt to migrate large assets to Git LFS was made, but GitHub rejected the push because the account exceeded its LFS budget.
- We exported the LFS pointers back to regular Git blobs.
- Trade-off: a full clone with history is ~263 MB. A `--depth=1` clone is much smaller and still gets the source and runtime assets needed to build.
- This is documented in `README.md`.

### 4. Add public README and clean agent tooling references

- `README.md` explains install-from-release, build-from-source, the release pipeline, and the `cell-key.pem` policy.
- `AGENTS.md` no longer names third-party assistants in the header.
- `.commit-msg.txt`, Devin CLI shortcut cheatsheet, and `Generated with Devin` / `Author: Devin` lines in docs/audits/ADRs were removed or generalized.

### 5. Keep `.devin/` and `.agents/` as project agent tooling

- These directories contain skills and hooks used by the project's own agent workflow.
- They are small, related to the development process, and not user-facing.
- If a fully "AI-tool-free" public tree is desired in the future, they can be removed as a separate task.

### 6. Run `npm audit fix` before final push

- `npm audit` found 4 moderate/high vulnerabilities in dev dependencies (`browserslist`, `nanoid`, `postcss`, `baseline-browser-mapping`).
- `npm audit fix` resolved all of them.
- Build, lint, typecheck, and 5,570 unit tests passed after the update.

## Consequences

- The public repository at `https://github.com/HaiDuongdarkocean/cell` no longer contains:
  - private keys,
  - `Generated with [Devin]` attribution,
  - unrelated local files,
  - `dist/`, `node_modules/`, coverage, or test output.
- `main` is force-pushed and the release tag `v0.1.1` is recreated with assets `cell.crx` and `updates.xml`.
- Extension ID remains `pmijadnofjnbndbgbnmpmdelgokgjjnn`.
- Update manifest is reachable at `https://raw.githubusercontent.com/HaiDuongdarkocean/cell/main/updates.xml`.
- The release `.crx` is reachable at `https://github.com/HaiDuongdarkocean/cell/releases/download/v0.1.1/cell.crx`.

## Verification performed

```bash
git status --short                  # clean
git log --oneline --decorate -5     # main and v0.1.1 visible
git remote -v                       # origin = https://github.com/HaiDuongdarkocean/cell
git fsck --full --no-reflogs        # no dangling objects
git count-objects -vH               # pack ~263 MB
npm ci                              # installed clean
npx tsc --noEmit                    # pass
npm run lint                        # pass
npm run build                       # pass
npm run test:unit                   # 5,570 passed
npm audit --json                    # 0 vulnerabilities
node -e "..." cell-key.pem          # extension ID = pmijadnofjnbndbgbnmpmdelgokgjjnn
```

## Notes

- `package.json` version is still `0.1.1`. The `v0.1.1` tag points to commit `efa34390`; subsequent commits on `main` are documentation and dependency cleanup.
- If the LFS budget is increased later, the LFS migration can be reattempted. However, for public cloneability the current pack-based approach is simpler and avoids quota failures.
