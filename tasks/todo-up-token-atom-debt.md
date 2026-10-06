# Todo: up-token-atom-debt (DELIVER)

Traced to `docs/specs/up-token-atom-debt.md` Success Criteria.

- [x] T1 REQ-1: token-name corrections (StudyModesTab×5, RecapTab×4, PlaylistTab: border-subtle/thick fallbacks + error/success×4) → AC-1/AC-2 (D1/D2 accepted deltas)
- [x] T1 REQ-2: `font-weight:600`→token (StudyModes×2); `50%`→`--radius-pill` (NavItem); `--radius-full`→`--radius-pill` 7-file converged set (NavItem, VocabularyTab, SettingsDialog, RecapTab, FieldRow×2, CandidateView×2, DictionaryCheckable) → AC-6; `94%`/`0.04em`/`ease-in-out` untouched
- [x] T2 REQ-3: `panelTabs.ts` (PANEL_TABS key/icon/label/shortLabel) consumed by UniversalPanel sidebar + BottomNav; both local TABS deleted; data-cell-ids stable → AC-3
- [x] T3 REQ-4: `variant="unstyled"` on Button/Input/Textarea (+Textarea ref); FieldRow textarea+tag input migrated, `isComposing` guard (D3); CandidateView 3 buttons migrated + 3 decorative checkbox inputs deleted (label→span, stopPropagation dropped); VocabularyTab Icon barrel + size mapping → AC-4/AC-5
- [x] T4 REQ-5: panel Escape → pushEscapeLayer (ref-pinned, [isOpen]); Dialog/BottomSheet/Drawer atoms on-stack; ResourceCard/DictLinksManager/MultiSelect/useSectionDrag transient layers; popupLifecycle composedPath layer (push 0→1, unregister empty+dispose, exact formula); Dictionary.tsx onKeyDown deleted; regionSelector/PlayerModeOverlay→window capture+preventDefault; statusKeyControls preventDefault-on-consume → AC-7; D4–D8 recorded in plan
- [x] T5 REQ-6: role="presentation" deleted; will-change deleted outright; docstring truthful; setVisitedTabs in effect + same-commit mount gating; recap activeTab-only gating kept → AC-8
- [x] T6 REQ-7: checker path…/​--rules/bypass/exit-2; `check-design-system-css:features` script + prebuild wire → AC-9/AC-10
- [x] T7 tests: UniversalPanel comments; ResourceCard/ResourcesPanel stub-layer assertions; Dictionary.test retargeted to popupLifecycle layer; MultiSelect.test act-wrap
- [x] Gates: typecheck ✅ · scoped eslint ✅ (repo-wide lint blocked by another agent's untracked `src/entrypoints/mockup-up-settings-subnav/main.tsx` — 2 pre-existing `react/no-unescaped-entities` errors) · test:unit ✅ 8048/8048 · build ✅ · check-design-system-css:features ✅ 0 violations/44 files
- [x] docs/2-architechture-system.md updated (panelTabs row, escapeLayerStack row, UniversalPanel/WebTextDictionaryController/useSectionDrag/PlayerModeOverlay/atom entries)
- [ ] Real-Chromium verification (Playwright persistent profile per testing-extension-browser) — deferred to parent; jsdom exercises the real document-capture stack
- [ ] Report to parent (no commit, no pipeline-state transition)
