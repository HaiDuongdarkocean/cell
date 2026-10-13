# Plan — up-settings-subnav (BUILD)

> Spec: `docs/specs/up-settings-subnav.md` · Brief: `docs/intent/up-settings-subnav-design-brief.md` · Mapping: `docs/intent/up-settings-subnav-component-mapping.md`
> Spec review verdict: APPROVE_WITH_CHANGES — all 3 action items already applied to spec (gap/padding restore on `.horizontal`, dormant `.label` ellipsis, wrapper semantics). Design review: PASS.

## REQ → diff map

| REQ | File | Change |
|---|---|---|
| REQ-1, REQ-5, REQ-6 | `src/shared/ui/NavItem.module.css` | `.horizontal`: drop `padding:0; gap:0`, gain `padding: 0 var(--space-3)` (same inline padding as `.vertical`); delete `.horizontal .label{display:none}`; scope `min-width/overflow/text-overflow` of `.label` to `.vertical` so ellipsis can never silently fire in horizontal. `.vertical` + `@container` rules byte-identical; horizontal pill recipe untouched. |
| REQ-3 | `src/shared/ui/Navigation.tsx` | Horizontal branch: wrap `<nav>` in `.navWrap` div; `showLeft`/`showRight` state driven by `ResizeObserver` + passive `scroll` on the nav element (StudyModeActionBar precedent); conditional `Button size="sm" shape="circle" variant="secondary" ripple={false} type="button"` + `Icon chevronLeft/chevronRight`; `scrollBy(±0.75*clientWidth, smooth)`; `aria-label` `settings.nav.scrollLeft/Right`; `data-tihoka-id="settings-nav-scroll-left|right"`; fade classes toggled on `<nav>`. Vertical returns bare `<nav>` (DOM unchanged). |
| REQ-3 | `src/shared/ui/Navigation.module.css` | `.horizontal` += `overscroll-behavior-x: contain`; add `.navWrap` (`flex:1; min-width:0; display:flex; align-items:center; gap:--space-1`), `.arrow` (flex:none + `--touch-target` min block/inline), `.fadeStart`/`.fadeEnd`/`.fadeStart.fadeEnd` mask gradients over `--space-6`. |
| REQ-2 | `src/features/settings/ui/SettingsDialogContent.tsx` | `:139` `containerWidth < BREAKPOINTS.medium` → `containerWidth < SIDEBAR_LABEL_MIN_WIDTH` (SSOT 768); drop now-unused `BREAKPOINTS` import; `sidebarExpanded`/`collapsed` expressions stay (collapsed rail becomes unreachable). |
| REQ-3 i18n | `en.json`/`vi.json` | `settings.nav.scrollLeft/scrollRight` already present (dirty) — keep. |

## Tests

- `Navigation.test.tsx`: add overflow-affordance cases — no arrows when strip fits (jsdom default), right arrow on overflow + `scrollBy` ≈0.75·clientWidth on click, left arrow appears after scroll, arrows hide at bounds, aria-labels present. Technique: `Object.defineProperty` scroll metrics on the `<nav>`, `fireEvent.scroll`, `nav.scrollBy` spy.
- `SettingsDialogContent.test.tsx`: add `<768px` cutoff coverage — mock `ResizeObserver` to report width 700 → `data-orientation="horizontal"` on the sidebar aside, no `data-collapsed`; 800 → `data-orientation="vertical"`.

## Docs

- `docs/2-architechture-system.md`: update `Navigation.tsx` row (overflow affordance) + `SettingsDialogContent` row (cutoff `<SIDEBAR_LABEL_MIN_WIDTH`/768, collapsed rail unreachable).
- `docs/0-wiki.md`: changelog line if the file tracks doc changes.

## Evidence

- `tmp/up-settings-subnav/` screenshots via real Chromium (Playwright) against served design-system build: showcase `SettingsPage` (dialog `navMode=auto`) + `UniversalPanelPage` (panel `navMode=horizontal`, real `SettingsTab`) at 320/390/700/≥768, en+vi, plus mid-scroll both-edges + arrow-click states.

## Gates

`npm run typecheck` · `npm run lint` · `npm run test:unit` · `npm run build` (prebuild chain includes `check-design-system-css:features`).

## Out of scope (per spec boundaries)

- No `tablist`/`tab`/`tabpanel`, no roving tabindex, no hit-target resizing (item 30)
- No `UniversalPanelBottomNav` changes (item 31), no recipe convergence (item 33)
- `NavItem` `.vertical` + `@container` collapsed rules untouched; `SettingsDialog.module.css` `min-width:600px` rule untouched
- No commits, no pipeline-state mutations — coordinator owns both
