# Design Review — up-a11y-hit-targets (`all` mode)

Reviewed: `docs/intent/up-a11y-hit-targets-design-brief.md` + `docs/intent/up-a11y-hit-targets-component-mapping.md` + mockup `src/entrypoints/mockup-up-a11y-hit-targets/` served at `http://localhost:5219/...` (Playwright persistent Chromium, mobile 430px + desktop 1280px, light + dark). Evidence: `tmp/up-a11y-hit-targets/` (screenshots + measure/verify scripts).

## Contract check

- [x] Brief + mapping at canonical paths; `node scripts/check-design-brief.mjs up-a11y-hit-targets` → `design brief ok — 16 tokens, 15 components, 7 icons · VERDICT: PASS`
- [x] One justified variant ("Inset-paint floor") + ASCII sketches in brief — justified as structurally forced, not stylistic
- [x] Every element mapped reuse/extend/redesign/create — **zero creates** (no new shared components needed)
- [x] Mockup mounts the real `UniversalPanel` (Dictionary/StudyModes/Settings tabs, mock profiles, mock dictionary transport) inside `ViewportFrame` iframe so real `@media` breakpoints apply
- [x] Mobile + desktop, light + dark screenshots captured; before/after + closeup evidence pairs captured

## The load-bearing design finding

**`::before` bleed — the spec's fallback mechanism — is unshippable.** REQ-8's collector measures `el.getBoundingClientRect()` (`universal-panel-ux-audit.spec.ts:247-263`); pseudo-element overflow never enters the rect, so a bleed fix stays a violation forever. DESIGN collapsed the ladder: every site gets real-box growth (`min-*`), and where paint must stay small the recipe is transparent `border-*` inset + `background-clip: padding-box` — measured live:

| Site | Box before → after (coarse) | Painted size after |
|---|---|---|
| Toggle xs input | 36×20 → **44×44** | 36×20 (border-block 12px + border-inline 4px transparent, padding-box clip, radius stays pill) |
| Toggle sm | 60×32 → **60×44** | unchanged |
| `.statusBadge` (Known) | 84×20 → **84×44** | 20px-tall pill, full width (border-block 12px only) |
| Profile flag button | 34×34 → **44×44** | flag pinned 34×34 |
| `.actionSlot` sm circle | 32×32 → **44×44** | halo fills the reserved slot |
| `.nameButton` (dict-link) | 73.9×17 → **174×44** | transparent chrome — no visual change |
| DragHandle grip | 40×40 → **44×44** | dots unchanged |
| HintIcon / kebab / sheet close / audio play | 28–32 → **44²** | glyphs unchanged |
| Dict toolbar tabs | ~110×44 h→44 | chrome row taller (accepted) |
| Fields (`Input` md/sm, `Select`) | 28–38.8 → **44** | painted field grows — D5 decision |
| MobileSheet handle | 328×32 → **328×44** | pill unchanged; peek +12px (D6) |

**After-fix coarse run: 21/21 interactives ≥44px on both axes, 0 violations** (before: 18 violations). Fine-floor run: all ≥40px. Live DOM check on the real panel at 390px confirms the REQ-3 precondition verbatim: `domOrder: [bottom-nav, sidebar, body]` with nav visually at bottom (top 642 of 696px) — inverted focus order proven on shipped code, so the atomic DOM-move + `column` pair is correctly aimed.

## Judged against the vision checklist

1. **Surfaces** — unchanged; specimen uses only existing atoms + feature module classes (`VocabularyTab`, `DictLinksManager`, `MobileSheet`, `UniversalPanelHeader` modules imported, not re-drawn). ✓
2. **Shape** — no new radii; pill/track radii preserved through the padding-box clip (verified: `borderRadius 9999px`, paint edge stays pill). ✓
3. **Typography** — untouched (N2). ✓
4. **Touch targets** — measured ≥44 coarse / ≥40 fine on every specimen site. ✓
5. **States** — debug ring overlay proves the grown box is the measured box; before/after toggle shows pixel-parity of painted controls. ✓
6. **Deviations vs shipped panel** — none visual by design; the only visible change is field height (32→40/44px), pre-accepted by spec as the metrics shift DESIGN owns.

## Decisions recorded (design-owned open questions from spec)

- **Min-hit vs painted split** → inset-paint pattern (transparent border + `background-clip: padding-box`); `::before` bleed rejected globally (unmeasurable + neighbor-risky).
- **Toggle label-vs-track** → label+input box grows, track paint stays `toggle-w`×`toggle-h`; thumb re-anchored center-calc; one rule set covers xs→lg via `max(0px,…)`.
- **Input visual height** → painted field grows to floor (field = its own affordance); atom-level `min-height: max(input-height-*, touch-target)`.
- **MobileSheet handle** → real growth, peek eats +12px (56→64/68); JS peek constant becomes `calc(touch-target …)` so CSS stays SSOT.
- **Status region** → `VisuallyHidden` `role="status"` + `aria-atomic`, dedupe by last-announced summary.
- **aria-current** → `'page'` on both surfaces; `CollapsibleSidebar` literal flip is safe (sole consumer, paint rides `.item.active`); bottom-nav CSS selector → `[aria-current]` presence form; `as="nav"` on the sidebar.

## Needs carried to DELIVER

- Rect-intersection check must whitelist ancestor containment (kebab-over-card) and flag only sibling overlap.
- `useFocusTrap` initial pick reuses the existing `offsetParent` visibility filter; deferred self-focus targets must be visible + in-dialog.
- `box-sizing: border-box` asserted on `.input` before the border-inset trick (module currently relies on it implicitly).
- New i18n keys en+vi: `studyModes.advancedToggle.hint`, `playlist.status.ready|failed` (pluralized); pane labels reuse `panel.tab.*`.
- Watch: `up-mobile-chrome.md:42` cites `aria-current="true"` — flag stale when this lands.

VERDICT: PASS
