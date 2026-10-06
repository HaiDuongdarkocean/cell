# Todo — up-a11y-hit-targets (item 30)

- [x] REQ-1: hit-target floor — `.panel .body button` scoped rule + named-site bindings (Toggle inset-paint, statusBadge, actionSlot, dict-links grip/name/row, HintIcon, modeMenuTrigger, dict toolbar tabs, profile flag, CloseButton, audio tester play, all field atoms `max(field, --touch-target)`, Checkbox/Radio hidden input `inset:0`, `.slider.compact`, MobileSheet handle + measured peek, FieldRow `.fieldInput*`/`.tagInput*` wrappers + unstyled tag field, dictionary searchField pill `max(--space-10, --touch-target)`)
- [x] REQ-2: `useFocusTrap` initial focus uses the same `offsetParent` visibility filter as Tab cycling + panel fallback; tab-switch effect rescues focus to the visible nav item when the previous activeElement ended outside the panel or inside a `hidden` pane
- [x] REQ-3: bottom nav JSX moved after `.body`; mobile `column` (no `column-reverse`); DOM = sidebar → body → bottomNav
- [x] REQ-4: sidebar `as="nav"`, both navs labelled, `aria-current="page"`, bottom-nav selector `[aria-current]` presence, all panes `role="region"` + localized `aria-label`
- [x] REQ-5: custom modes grid `role="radiogroup"`
- [x] REQ-6: `Toggle` `ariaControls`/`ariaDescribedby` passthrough; Advanced switch wired + named region + VisuallyHidden hint + i18n en/vi; `advanced-settings-region` stays mounted under `hidden` so `aria-controls` never dangles (`.stack[hidden]` guard added to Stack.module.css)
- [x] REQ-7: playlist single `role="status" aria-atomic` announcer rendered in every state (loading/empty/list) + `summarizeStatusTransitions` + dedupe + i18n; per-card `aria-live` removed
- [x] REQ-8: audit spec honest collector (pointer-derived floor, both dims, ancestor-clip-aware `effectiveRect` overlap check, 0.5px subpixel-seam epsilon, containment whitelist) + `collectA11yStructure` + `focusTrail` + CDP touch-emulation coarse pass
- [x] Tests: `playlistStatusSummary.test.ts` (6 cases); `UniversalPanel.test.tsx` nav-tag expectation updated
- [x] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated
- [x] Gates: `npm run typecheck` ✅, `npm run lint` ✅ (0 errors, 4 pre-existing srs warnings), `npm run test:unit` ✅ (681 suites / 8064 tests), `npm run build` ✅
- [x] Verify: real-Chromium audit run `a11y: pointer-adaptive hit target floor, focus and semantics` ✅ (fine 1440×900 all 6 tabs + semantics + focus trail + playlist announcer + mobile DOM order + CDP coarse 390×844 all 6 tabs + coarse desktop); evidence `loop/universal-panel-ux/image/a11y/{fine-desktop,fine-mobile,coarse-mobile,coarse-desktop}-*.png` + `state/computed-styles.json`
