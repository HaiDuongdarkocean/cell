# Plan — primer-tab-redesign (deliver scope: REQ-5 + REQ-6)

> Spec: `docs/specs/primer-tab-redesign.md` · Brief/mapping: `docs/intent/primer-tab-redesign-*`
> Scope carve-out (2026-09-19): REQ-1..4 + meta variant owned by another agent's in-flight
> work — this plan covers ONLY REQ-5 + REQ-6. Do not touch `PrimerTab.*`/`FrequencyBadge`.

## Tasks

| # | Task | Files | REQ/AC | Parallel |
|---|------|-------|--------|----------|
| 1 | Worktree + branch `feat/primer-tab-redesign`, junction node_modules | — | infra | — |
| 2 | `crosshair` icon entry (mirror of main-tree edit) | `src/shared/icons/index.ts`, `svg/crosshair.svg` | REQ-6 | yes |
| 3 | i18n `cueList.syncToVideo` en + vi | `src/shared/i18n/messages/{en,vi}.json` | REQ-6, NFR-3 | yes |
| 4 | REQ-5: `showTabs` → renderable-tab count > 1 | `SubtitlePanel.tsx` | REQ-5, SC-11 | yes |
| 5 | REQ-6: desync + pill in CueList | `CueList.tsx`, `CueList.module.css` | REQ-6, SC-12, SC-13, NFR-6 | yes |
| 6 | Unit tests: single-tab DOM absence; desync→pill→resync; seek-resync; filterEpoch reset | `SubtitlePanel.test.tsx`, `CueList.test.tsx` | SC-11..13 | yes |
| 7 | Gates: typecheck + lint + test:unit + build | — | DoD | — |
| 8 | Fresh-context verify → `docs/reviews/primer-tab-redesign-verify.md` | — | verify gate | — |
| 9 | Merge branch → main worktree; delete branch + worktree; mockup dir delete decision | — | ship | — |
| 10 | Browser verify (uiSurface=yes) + sign-off → `transition --to shipped` | — | ship | — |

## Design decisions locked (from brief)

- REQ-5: strip iff `1 + hasPlaylist + (primerAvailable && primerRows !== null)` ≥ 2.
- REQ-6 state machine: FOLLOWING →(user scroll: |scrollTop − expected| > 2px)→ DESYNCED(+pill)
  →(pill click / timestamp seek / filterEpoch)→ FOLLOWING.
- Programmatic align records `expected` scrollTop (ref, not state); divergence = user scroll
  — catches scrollbar drags, external `scrollPositionPreserve` restores.
- Pill: `Button variant="overlay" shape="pill" size="sm" elevation="med"` +
  `Icon name="crosshair"` + `data-cell-id="cue-list-sync"`, absolute bottom-center inside a
  new `position:relative` wrapper sibling-owning the scroller; list bottom-pads while shown.
- `data-cell-id="cue-list-scroll"` stays on the scroller element — selectors unchanged.

## Blocked / risk

- `SubtitlePanel.test.tsx`, `en.json`, `vi.json` are dirty in main (other agent's lane) —
  my edits go on the branch; merge may need their commit first (different regions, should
  resolve cleanly).
- Layout shift when Words tab appears post-resolution — accepted (spec).
