# Plan — anki-notetype-pills

Spec: `docs/specs/anki-notetype-pills.md` · uiSurface: yes · interactive

Single-lane XS/S build (one component surface + one pure helper). No worktrees.

| # | Task | AC trace | Status |
|---|---|---|---|
| 1 | `logic/notetypeSelection.ts` — `pillNotetypes` (enabled ∩ cards≥1, order preserved) + `nextEnabledNotetypeId` (wrap fallback after removed id) + co-located unit tests | AC-1, AC-5, AC-6 | done |
| 2 | `MappingStep`: `selectedNtId` state, effective `nt` derived, samples scoped per-notetype (≤4), pill `selectNt` resets `sampleIdx`/unflips | AC-2, AC-3 | done |
| 3 | `.ntBar` — borderless bar above field rows: pill `Chip`s left, ghost `IconButton slidersHorizontal` right; renders even when zero pills | AC-1, AC-7, AC-9 | done |
| 4 | Manage surface — desktop `Popover variant="menu"` right-aligned (useDismissOnScroll + pushEscapeLayer restore-focus + outside mousedown composedPath + Tab wrap containment); mobile `BottomSheet`; rows = all non-cloze notetypes with `Checkbox variant="row"` | AC-4, AC-8 | done |
| 5 | `canContinue` requires ≥1 enabled nt with cards; empty state keeps manage icon reachable | AC-7, AC-11 | done |
| 6 | Remove `advRow` disclosure; i18n `advanced.*` → `notetypes.title/manage` (en+vi) | AC-1 | done |
| 7 | Gates + real-Chrome verify (`tmp/anki-notetype-pills/verify.mjs`, multi-notetype fixture) + screenshots | AC-10, DoD | done |
| 8 | Arch doc + wiki changelog, commit, ship | DoD | in progress |
