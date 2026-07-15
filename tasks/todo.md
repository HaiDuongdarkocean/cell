# Todo — Align src components to DS showcase

## Phase 1: Token foundation + core form components
- [x] 1. Fix theme.css tokens (radius md 8→18, lg 12→10, add xl/2xl, shadow→none, add primary-active/success-subtle/warning-subtle, fix error-subtle alpha)
- [x] 2. Button.module.css — radius var, focus→outline, remove box-shadow transition
- [x] 3. Input + Textarea — focus→outline, radius var

## Phase 2: Rest of shared/ui form components
- [x] 4. Select + SearchableSelect — focus→outline, shadow→none
- [x] 5. Checkbox + Radio + Toggle — focus→outline
- [x] 6. Slider + ShortcutInput — shadow→none, focus→outline

## Phase 3: shared/ui display/container components
- [x] 7. Card — shadow→none, radius var
- [x] 8. Dialog + Drawer + BottomSheet — shadow→none, radius var
- [x] 9. Accordion + Tabs + NavItem + ListItem — focus→outline
- [x] 10. Badge + Alert + Tooltip + Header + HintIcon — shadow→none, radius var
- [x] 11. Progress + Spinner + Skeleton + EmptyState + Sidebar — shadow→none

## Phase 4: Feature components part 1
- [x] 12. CardCreatorDialog + FieldRow + MediaList + PreviewBlock
- [x] 13. DeleteConfirmModal + Dropzone + ImportProgress + ResourceCard + ResourcesPanel

## Phase 5: Feature components part 2
- [x] 14. SettingsDialog + MultiSelect + CardCreatorSettingsPanel + NavClusterSettingsPanel
- [x] 15. SubtitleBlockSettingsPanel + SubtitlePreview + SubtitleStylePanel
- [x] 16. ThemePanel + ColorCustomization + ContrastBadges + ModeCards + ThemeImportExport + ThemePreview
- [x] 17. App.redesigned + SelectionBar + Header + DownloadCard + MediaEmpty + SubtitleCard + VideoCard
- [x] 18. OptionsApp + SidebarItem + sidepanel App + CueList

## Phase 6: Final audit + report
- [x] 19. Token audit — grep hardcode→0
- [x] 20. Browser verify (dark + light)
- [x] 21. Báo cáo component DS không cover → xem `tasks/report.md`

---

# Todo — Complete Popup Dictionary + ADR-037

> Source: `tasks/plan.md`, `docs/specs/spec-popup-dictionary.md`, `docs/adr/037-english-phrase-match.md`.
> Mode: no-yapping / caveman. One checkbox = one atomic commit.
> Existing dirty non-dictionary changes stay untouched.

## Baseline already green

- [x] B1. Cambridge parser + AST validator
- [x] B2. Fixture parser compile for 34,094 terms
- [x] B3. Phrase index compiler + compact blob round-trip
- [x] B4. IndexedDB v10 `langPhraseIndex` store + repository CRUD
- [x] B5. Bounded DP matcher + deterministic ranking
- [x] B6. Phrase service + word fallback + cancellation
- [x] B7. Initial compile/blob/match benchmark

## Phase 0 — Contracts

- [x] 0.1 Reconcile ADR/spec/architecture with actual source and dirty git state
- [x] 0.2 Define Lookup/Worker/QuickAdd/WordStatus types and Zod schemas
- [x] 0.3 Prove worker topology, transferable hydration, requestId cancellation

## Phase 1 — Phrase data plane

- [x] 1.1 Build Cambridge phrase blob during import; rollback atomically on failure
- [x] 1.2 Add compiler-versioned blob loader and worker anchor index
- [x] 1.3 Add top-10k LRU, miss hydration, and exact 10k cap
- [x] 1.4 Fix multi-resource priority and real sourceResourceId
- [x] 1.5 Close P01–P33/N01–N20 and exhaustive fixture strict tests

## Phase 2 — Plugins and lookup

- [x] 2.1 Define LanguagePlugin + English plugin + minimal fallback
- [x] 2.2 Add Chinese FMM + pinyin + chengyu hook
- [x] 2.3 Build lookup orchestrator/result assembler
- [x] 2.4 Wire subtitle trigger, debounce, tab scope, and cancellation

## Phase 3 — Storage and settings

- [x] 3.1 Add persistent four-state word status store
- [x] 3.2 Add settings schema v14 and Card Creator auto-complete settings
- [x] 3.3 Add validated status/audio/image/TTS/QuickAdd message contracts

## Phase 4 — UI core

- [x] 4.1 Wrap subtitle EN words/ZH segments and emit lookup requests
- [x] 4.2 Build Shadow DOM popup shell, auto-position, resize, sticky size
- [x] 4.3 Build header, definitions, checkboxes, footer status cycle
- [x] 4.4 Build toolbar + lazy audio/image panels
- [x] 4.5 Build lazy translate/external-link panels
- [x] 4.6 Build settings UI for trigger/tab/size/language/SRS

## Phase 5 — P0 integration

- [x] 5.1 Assemble selection-aware Quick Add payload
- [x] 5.2 Connect Anki Quick Add, offline retry, field-mapping errors
- [x] 5.3 Wire full P0 subtitle → lookup → popup → Quick Add journey

## Phase 6 — Release gates

- [x] 6.1 Security/boundary audit; no unsafe HTML/URL/logging
- [x] 6.2 Real worker heap + latency benchmark on low-memory target
- [x] 6.3 Accessibility/responsive/dark-light browser audit
- [x] 6.4 Update ADR/spec/wiki/architecture and final review

## P1 after P0

- [ ] P1.1 Generic web-text selection/hover lookup
- [ ] P1.2 Send to Creator two-pane workspace
- [ ] P1.3 Card Creator full restyle
