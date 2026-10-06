# Plan — up-a11y-hit-targets (item 30, DELIVER)

> Spec: `docs/specs/up-a11y-hit-targets.md` · Design: `docs/intent/up-a11y-hit-targets-design-brief.md` + `-component-mapping.md` · Review: `docs/reviews/up-a11y-hit-targets-design.md`

## Approach

"Inset-paint floor": grow the *real* element box to `var(--touch-target)` (44px coarse / 40px fine, existing token alias — no token edits) and keep compact paint via transparent borders + `background-clip: padding-box` where a control must not visibly grow. No `::before`/`::after` hit bleed — the audit measures `getBoundingClientRect()` only.

Two coverage tiers:

1. **Scoped floor** — `.panel .body button { min-width/min-height: var(--touch-target) }` in `UniversalPanel.module.css` (specificity 0,2,1 beats Button's `.iconOnly,.circle { min-*:0 }` reset). Covers every button inside header + all six panes + inline sheets/dialogs in one rule instead of ~15 per-site overrides.
2. **Named-site bindings** — spec-enumerated controls get explicit bindings: Toggle (inset-paint at the input), Vocabulary statusBadge + actionSlot, DictLinksManager grip/nameButton/row, HintIcon, modeMenuTrigger, dictionary toolbar tabs, profile flag (flag paint pinned at 34px inside a floor box), BottomSheet close via shared `CloseButton`, audio tester play, MobileSheet handle + measured peek, all field atoms at `max(field-height, var(--touch-target))`, Checkbox/Radio hidden inputs stretched `inset:0` over their floor-sized label.

## Per-REQ implementation

| REQ | Change | Files |
|---|---|---|
| REQ-1 hit-target floor | `.panel .body button` scoped floor; Toggle `.toggle`/`input`/`thumb` inset-paint math; `min-width/min-height: var(--touch-target)` (or explicit w/h, or `max()` for fields) on every enumerated site; `.slider.compact` box → floor keeping thin painted track; MobileSheet `.handle` `min-height: var(--touch-target)` + collapsed peek `calc(var(--touch-target) + var(--space-6))` + JS drag math measures handle+header rects instead of stale 32/56px constants | `UniversalPanel.module.css`, `Toggle.module.css`, `VocabularyTab.module.css`, `DictLinksManager.module.css`, `HintIcon.module.css`, `StudyModesTab.module.css`, `DictionaryToolbar.module.css`, `UniversalPanelHeader.module.css`, `BottomSheet` (via `CloseButton.module.css`), `AudioPanel.{tsx,module.css}`, `Input/Select/SearchableSelect/SearchField/Textarea/MultiSelect/Pagination/Checkbox/Radio/Slider/SegmentedControl.module.css`, `MobileSheet.{tsx,module.css}` |
| REQ-2 focus trap | initial focus picks first *visible* focusable (`offsetParent !== null || el === root.activeElement` — same filter as the Tab cycle) + panel-focus fallback | `useFocusTrap.ts` |
| REQ-3 mobile DOM order | `<UniversalPanelBottomNav>` moved after `.body` in JSX; mobile `flex-direction: column` (was `column-reverse`) — DOM = sidebar → body → bottomNav = visual order = focus order | `UniversalPanel.tsx`, `UniversalPanel.module.css` |
| REQ-4 nav + panes | `CollapsibleSidebar as="nav"`; both navs labelled; `aria-current="page"` on active items (shared `NavItem.module.css` `"true"` selectors untouched); bottom-nav active CSS → `[aria-current]` presence; every `.tabPane` `role="region"` + localized `aria-label` | `UniversalPanel.tsx`, `CollapsibleSidebar.tsx`, `UniversalPanelBottomNav.{tsx,module.css}` |
| REQ-5 radiogroup | custom-modes grid `role="group"` → `role="radiogroup"` (presets grid was already a labelled radiogroup); kebab stays a sibling of the radio card | `StudyModesTab.tsx` |
| REQ-6 advanced switch | `Toggle` accepts `ariaControls`/`ariaDescribedby` → forwarded to the native input (`role="switch"`, `aria-checked` stays the state carrier, no `aria-expanded`); Advanced section wires `advanced-settings-region`/`advanced-settings-toggle-hint` ids, VisuallyHidden hint, controlled `<div id role="region" aria-label>`; new i18n keys en+vi | `Toggle.tsx`, `StudyModesTab.tsx`, `en.json`, `vi.json` |
| REQ-7 playlist status | single VisuallyHidden `role="status" aria-atomic="true"` (`playlist-status-announcer`); per-card `aria-live` removed (cards stay `role="listitem"`); pure helper `summarizeStatusTransitions` diffs prev/next status map per `refresh()`, counts only transitions into ready/failed, joins plural-aware localized parts; `lastAnnouncedRef` dedupes identical summaries; loading spinner `role="status"` is the only status while `records === null` — never two at once | `PlaylistTab.tsx`, `playlistStatusSummary.ts` (new), `en.json`, `vi.json` |
| REQ-8 verification | collector derives floor from `matchMedia('(pointer: coarse)')` (not viewport width), measures **both** dims, pairwise overlap scan with ancestor/rect-containment whitelist (mode-card kebab painted over its radio card), new `collectA11yStructure` evidence (nav landmark/labels/`aria-current`, pane regions, DOM order via `compareDocumentPosition`, switch wiring, single status announcer, `lastFocusableInBottomNav`, `initialFocus` visibility), `focusTrail` Tab-cycling evidence, CDP `Emulation.setEmulatedMedia {pointer:coarse}` pass asserting the media query flipped + 44px floor at 390 + 1440 | `e2e/stage2/universal-panel-ux-audit.spec.ts` |

## Tests

- `playlistStatusSummary.test.ts` (new): first refresh silent, unchanged silent, singular/plural ready+failed combined, non-final transitions ignored, unseen records ignored.

## Docs

- `docs/2-architechture-system.md`: Toggle rows (×3), UniversalPanel row (DOM order + nav/pane semantics + floor rule), MobileSheet row, useFocusTrap row, DictLinksManager row, playlist paragraph, tree Toggle line.
- `docs/0-wiki.md`: changelog row.

## Boundaries respected

No `tokens.json`/`tokens.css` edits (uses existing `--touch-target` alias only), no `manifest.json`, no new deps, no pseudo-element bleed, mockup dir untouched, `settings.nav.scroll*` i18n keys untouched, `NavItem.module.css` `[aria-current="true"]` selectors untouched (other consumers emit `"true"`), shared `Toggle` props are optional passthroughs (no breaking change). No commit; `tasks/pipeline-state.json` not mutated.
