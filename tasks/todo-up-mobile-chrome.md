# Todo — up-mobile-chrome (item 31)

- [x] REQ-1: `mobileNav:'bar'|'tools'` on `PANEL_TABS`; `PANEL_BAR_TABS`/`PANEL_TOOLS_TABS` derived; rail = 4 tabs + Tools; Playlist/Recap rows in the Tools sheet activate + close + `aria-current`
- [x] REQ-2: bottom-centered `::after` pill on active rail item (color + position); left-edge `::before` pill on active demoted row; demoted active tab paints no rail pill
- [x] REQ-3: `UniversalPanelHeader` `activeTab` prop → full localized `panel.tab.*` title, ellipsizing `flex:1`, hidden ≥840px
- [x] REQ-4: tokenize capsule natural-width (`inline-flex`, no `fullWidth`) + hairline seam between halves
- [x] REQ-5: `.panel` ≤839px `width:100%; height:100%/100dvh; max-width:none; radius:0; column` — ≤599 block deleted, no 600–839px hybrid
- [x] REQ-6: `mountOrbitalBadge` `panelSuppressed` flag on `onOpenChange`; fullscreen restore consults flag; unsubscribe on destroy
- [x] REQ-7: `MobileSheet header={t('cardCreator.title')}`; `.sheetHeaderTitle` 12px ellipsis; rightPane peek reserve `calc(--touch-target + --space-6)`
- [x] REQ-8: `hideDragHandle` on all five BottomSheet consumers; `.sheet` `padding-bottom`/`scroll-padding-bottom` `--space-8`; 44px close floor verified from item 30
- [x] REQ-9: vocabulary `.toolbar` `overflow-x:auto`, `.toolBtn` `flex-shrink:0`, `.toolbarSpacer` collapses
- [x] i18n: `panel.tools.{title,sheetTitle}`, `panel.nav.aria`, `cardCreator.title` en+vi (values per spec)
- [x] Tests: `UniversalPanelBottomNav.test.tsx` (7 cases), `mountOrbitalBadge.test.tsx` suppression suite (3 cases)
- [x] Gates: `typecheck` pass, `lint` 0 errors (4 pre-existing SRS warnings), `test:unit` 681 suites pass, `check-design-system-css:features` 0 violations, `build` pass
- [x] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated; `tasks/plan-up-mobile-chrome.md` written
- [ ] Verify: real-Chromium pass at 320/390/600–839/≥840, en+vi, badge open/close/fullscreen, BottomSheet consumers; captures in `tmp/up-mobile-chrome/`
