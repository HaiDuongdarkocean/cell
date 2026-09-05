# Universal Panel + Extended Areas — Design-System Audit Close-out

**Date:** 2026-09-05 · **Branch:** `master` (local, no remote) · **Verification:** tsc ✅ lint ✅ 5437 unit tests ✅ build ✅ css-check 0 violations/87 files ✅ e2e showcase 7/7 + visual 22/22 + launcher 3/3 + subtitle-manager 1/1 ✅

## Scope covered

| Phase | Area | Result |
|---|---|---|
| Atomic-design audit | Universal Panel (Dictionary / Study Modes / Settings) | `docs/audits/universal-panel-*.md` — remediated in `2781ba14` + follow-ups |
| Extended audit T11–T15 | popup / sidepanel / launcher / subtitle / srs-study / Sheet+BottomSheet | `docs/audits/post-universal-panel-areas-audit-2026-09-05.md` |
| Leftover sweep | keyboard resize, dead CSS, ColorInput, disabled placeholders | Phase 6b in task file |

## Key numbers

- ~205 findings total (P0:9, P1:~32, P2:~103, P3:~63) — all P0/P1 closed, P2 tokenized or documented, P3 documented as intentional
- ~70 CSS/TSX files touched across the whole effort; net-negative diffs (deletion > addition)
- 4 stale test suites fixed; 10 ambiguous e2e selectors fixed; visual baselines regenerated after intentional design changes
- New shared atoms this effort: `ColorInput` (plus `MultiSelect`, `SelectableCard`, `BottomSheet` promoted earlier)

## Token pipeline discovery → ADR-098

`tokens.css` is **generated** from `tokens.json` via `scripts/generate-tokens.js`
(prebuild). New groups added this effort: `static.opacity` (`--opacity-20..85`),
`--tracking-wider/widest`. Registry parity required in `generate-tokens.js`,
`check-design-system-css.mjs`, and `lib/tokens.ts`. See ADR-098 for rules
(incl. the foreign-document `var()` ban).

## Deferred / open

| Item | Status |
|---|---|
| Git push | Blocked — no remote configured |
| `act()` warnings (~10) | Documented cosmetic — deferred render mounts in `.then` during `waitFor` |
| Launcher tile/button actions | `disabled` until product intent lands |
| `z-index` max-int literals | Intentional (foreign-document injection) |
| Full visual matrix for popup/sidepanel/overlay | Existing e2e covers showcase + launcher + subtitle-manager; deeper visual matrix optional |

## Commits (this session)

```
b216a080 docs(tasks): T11-T15 closed
689437c7 chore(design-system): T13 P2 tokenization + dead CSS sweep
e51bb2ff docs(tasks): mark T11/T12 progress
63101f0a feat(a11y+ssot): P1 atom migrations + token fixes
2081ec82 fix(a11y+tokens): P0 sweep
397cac15 chore(settings+audit): SettingsDialog CSS split + audit doc
c8a24f38 feat(a11y): keyboard resize + dead-CSS sweep + ColorInput atom
```
