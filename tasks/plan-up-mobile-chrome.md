# Plan — up-mobile-chrome (item 31, DELIVER)

> Spec: `docs/specs/up-mobile-chrome.md` · Design: `docs/intent/up-mobile-chrome-design-brief.md` + `-component-mapping.md` · Review: `docs/reviews/up-mobile-chrome-design.md` · Mockup: `src/entrypoints/mockup-up-mobile-chrome/` · Audit: `docs/audits/20261006-universal-panel-ux-audit.md`

## Approach

One honest chrome model per width: the panel owns the viewport edge-to-edge
below 840px, navigation regresses to five destinations, and every affordance
that isn't functional is removed rather than decorated.

1. `PANEL_TABS` gains `mobileNav: 'bar' | 'tools'` — the registry stays SSOT;
   `PANEL_BAR_TABS` / `PANEL_TOOLS_TABS` are derived filters, not a second list.
   Playlist + Recap demote into the Tools sheet as navigation rows.
2. `UniversalPanelBottomNav` renders the four bar tabs + a Tools button; the
   Tools BottomSheet lists demoted nav rows (full labels, `aria-current`,
   left-edge `::before` pill) then the existing tool actions.
3. Active rail item = color + bottom-centered `::after` pill (NavItem
   `.horizontal .pill` recipe; `.navItem.navItem` doubling beats Button's
   `::after` overlay at (0,4,0)).
4. `UniversalPanelHeader` accepts `activeTab` and renders the full
   `panel.tab.*` label in a `flex:1` ellipsizing slot, hidden ≥840px.
5. Tokenize capsule goes natural-width (`display:inline-flex`, no `fullWidth`
   halves) with a hairline `border-left` seam on the second half.
6. `.panel` ≤839px: `width:100%; height:100%; height:100dvh; max-width:none;
   border-radius:0` — the old ≤599px-only fullscreen block is deleted.
7. `mountOrbitalBadge` keeps a `panelSuppressed` flag seeded from
   `isOpen()` and driven by the existing `onOpenChange` channel;
   `applyPanelSuppression()` is consulted by the fullscreen reparent/restore
   path (previously it re-showed `display` unconditionally → badge leak over
   the open panel).
8. Card Creator `MobileSheet` gets `header={t('cardCreator.title')}`; the
   collapsed peek is `calc(--touch-target + --space-6)` (reserved in
   `DictionaryTab.module.css` so the last dictionary row clears it).
9. BottomSheet honesty: `hideDragHandle` on all five consumers (no drag
   gesture exists anywhere), shared `--space-8` bottom padding +
   `scroll-padding-bottom` guard; CloseButton 44px coarse floor already
   shipped in item 30.
10. Vocabulary `.toolbar` becomes `overflow-x:auto` with `flex-shrink:0`
    controls and a spacer that collapses to zero at 320px.

## Per-REQ implementation

| REQ | Change | Files |
|---|---|---|
| REQ-1 five destinations | `mobileNav` field + derived `PANEL_BAR_TABS`/`PANEL_TOOLS_TABS`; rail = 4 tabs + Tools; sheet rows call `onTabChange` + close, `aria-current` when active | `panelTabs.ts`, `UniversalPanelBottomNav.tsx` |
| REQ-2 positional indicator | `.navItem` `position:relative` + `::after` bottom pill on `[aria-current]`; `.toolRow.navRowActive::before` left-edge pill; no pill when a demoted tab is active (absent from rail) | `UniversalPanelBottomNav.module.css` |
| REQ-3 header title | `activeTab` prop → `PANEL_TABS` label lookup → `.headerTitle` (12px-sm semibold, ellipsis, `display:none` ≥840px) | `UniversalPanelHeader.tsx`, `.module.css`, `UniversalPanel.tsx` |
| REQ-4 tokenize capsule | drop `fullWidth` halves; capsule `inline-flex` + `flex-shrink:0`; `.half + .half` hairline seam | `TokenizeControls.tsx`, `.module.css` |
| REQ-5 viewport ownership | `.panel` ≤839px `width/height 100%` + `100dvh` + `radius:0` + `max-width:none`; ≤599 block removed | `UniversalPanel.module.css` |
| REQ-6 orbital suppression | `panelSuppressed` flag + `applyPanelSuppression()` on `onOpenChange`; fullscreen restore consults flag; unsubscribe in `destroy()` | `mountOrbitalBadge.ts` |
| REQ-7 named peek | `header` prop = localized `cardCreator.title`, 12px/medium/tertiary ellipsis; rightPane reservation `calc(--touch-target + --space-6)` | `CardCreatorPanel.tsx`, `.module.css`, `DictionaryTab.module.css` |
| REQ-8 sheet honesty | `hideDragHandle` ×5; `.sheet` `padding-bottom`/`scroll-padding-bottom` `--space-8`; close ≥44px already floored by item-30 CloseButton | `BottomSheet.module.css`, `UniversalPanelBottomNav.tsx`, `CardCreatorBottomSheet.tsx`, `SrsReviewCard.tsx`, `ImportWizard.tsx`, `CustomModeBuilder.tsx` |
| REQ-9 toolbar | `.toolbar` `overflow-x:auto` + hidden scrollbar; `.toolBtn` `flex-shrink:0`; `.toolbarSpacer` min-width 0 | `VocabularyTab.module.css` |
| i18n | `panel.tools.{title,sheetTitle}`, `panel.nav.aria`, `cardCreator.title` en+vi | `messages/en.json`, `messages/vi.json` |

## Tests

- New `UniversalPanelBottomNav.test.tsx`: registry split (4 bar / 2 tools),
  exactly 5 rail destinations, `aria-current` on active bar item, no
  `aria-current` in rail when a demoted tab is active, sheet rows carry
  localized full labels + activate + close, demoted active row marked,
  `hideDragHandle` honoured.
- `mountOrbitalBadge.test.tsx` +3: open→hide/close→show, mount suppressed
  while open, `fullscreenchange` keeps suppression until close.

## Docs

- `docs/2-architechture-system.md`: universalPanel tree blurb, `panelTabs`
  row (mobileNav + demoted set), `UniversalPanel.tsx`/`.module.css` rows
  (≤839px fullscreen + five-destination rail), `UniversalPanelHeader` rows
  (mobile title), `mountOrbitalBadge` row (suppression channel).
- `docs/0-wiki.md`: changelog row.

## Boundaries respected

No `manifest.json`/`tokens.json`/`tokens.css`/token-source edits, no new
deps, no pipeline-state hand edits, `mockup-up-mobile-chrome/` preserved,
sibling items 28–30 contracts untouched (`aria-current`, `pushEscapeLayer`,
`useFocusTrap` visible-first, `.tabPane` keep-alive, `.scrollport`, 44px
CloseButton floor, MobileSheet header contract).
