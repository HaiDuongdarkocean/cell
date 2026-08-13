# UI DRY → SSOT Refactor Tasks

## Loop 1 — Loading spinner SSOT
- [x] Discover duplicate `@keyframes spin` / `.spinner` CSS
- [x] Plan spinner SSOT (use `shared/ui/Spinner`)
- [x] Refactor `Button` loading to use `Spinner`
- [x] Refactor `IconButton` loading to use `Spinner`
- [x] Refactor `VideoCard` downloading indicator to use `Spinner`
- [x] Refactor `SubtitleCard` downloading indicator to use `Spinner`
- [x] Refactor `MasteryBadge` in-progress icon to use `Spinner`
- [x] Remove duplicate `@keyframes spin` and `.spinner` CSS
- [x] Verify: typecheck, build (prod + dev) pass
- [x] Subagent verify AC for Loop 1

## Loop 2 — Card enter/expand animations SSOT
- [x] Discover duplicate `fade-in` / `slide-down` keyframes in VideoCard/SubtitleCard
- [x] Extract shared animation keyframes to `CardAnimations.module.css`
- [x] Refactor VideoCard and SubtitleCard to use shared animation classes
- [x] Verify: typecheck, build (prod + dev) pass
- [x] Subagent verify AC for Loop 2

## Loop 3 — Empty state SSOT
- [x] Discover duplicate empty state markup/CSS
- [x] Extend `EmptyState` with `size` prop (`md`, `compact`, `sm`) and extra props passthrough
- [x] Refactor `DictionaryPanelView`, `TranslatePanel`, `LinksPanel` to use `EmptyState`
- [x] Remove duplicate empty state CSS (`cellTranslateEmpty`, `cellLinksEmpty`, `cellAudioEmpty`, visual `dictionaryEmpty`)
- [x] Verify: typecheck, build (prod + dev), targeted unit tests pass
- [x] Subagent verify AC for Loop 3

## Loop 4 — Remaining empty states / chip / badge (future)
- [ ] Migrate `ImagePanel` and `CandidateView` definition empty states to `EmptyState`
- [ ] Scrollbar CSS consolidation
- [ ] Domain chip/badge consolidation to shared `Chip`/`Badge`
- [ ] Header/actions layout pattern consolidation
