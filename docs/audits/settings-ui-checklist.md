# Settings Tab — UI Scoring Checklist

Rubric for a fresh-context reviewer grading the Settings tab UI. Score each item **0 (fail) · 1 (partial) · 2 (pass) · N/A** and cite evidence (file, DOM node, computed style, or screenshot path). Do not score from taste — every score needs observable evidence.

## Evidence sources

- Screenshots: `tmp/settings-tab-redesign/after-{direct|dialog}-{320|600|1200}-{light|dark}-<section>.png` and `tmp/settings-tab-redesign/audit/*.png`
- Code: `src/features/settings/ui/`, `src/shared/ui/{SettingsSection,SettingsGroup,SettingsRow,Select,SearchableSelect,MultiSelect,Toggle,Slider,Menu,Popover,ShortcutInput}*`
- Copy: `src/shared/i18n/messages/en.json` (`settings.*`, `audio.*`, `tts.*`, `theme.*`)
- Tokens: `src/shared/styles/tokens.json` (generated `tokens.css`/`tokens.ts`)

## A. Strategy & purpose — every element earns its place

| # | Criterion | How to check |
|---|---|---|
| A1 | Each section description exists only when it teaches something the title+rows don't | grep `description={t(` in `SettingsDialogContent.tsx`; read each value — flag restatements |
| A2 | No decorative text: zero slogans, marketing copy, or filler sentences in rows | inspect every row description in en.json under `settings.*` |
| A3 | Primary action per section is findable within one scan | screenshots — can a first-time user name the most important control per section? |

## B. Information architecture

| # | Criterion | How to check |
|---|---|---|
| B1 | Section order matches frequency of use (General → profiles → daily-use → advanced) | `data-section` order in `SettingsDialogContent.tsx` vs nav order |
| B2 | Related controls group under `SettingsGroup` labels; no orphan rows floating between groups | JSX of each section |
| B3 | Section titles match nav labels exactly | compare `settings.nav.*` with `settings.*.title` in en.json |
| B4 | Every section reachable by one nav tap; `data-section` anchor works | `sectionRef`/`data-section` wiring |

## C. Copy economy — minimal, scannable text

| # | Criterion | How to check |
|---|---|---|
| C1 | No label repeats its description (e.g., "Enable X" + "Enables X") | read row title+description pairs in en.json |
| C2 | Row descriptions ≤ ~90 characters, one idea, no chained clauses | measure strings passed as `description`/`hint` |
| C3 | No description restates the title verbatim or lists the section's own rows | compare each `*.desc` against row titles |
| C4 | Secondary explanation lives in HintIcon (ⓘ), not inline body text, when it's nice-to-have | count inline descriptions that are really documentation |
| C5 | Action verbs on buttons, nouns on labels | audit button text vs labels |
| C6 | Empty states: one title + one sentence + one CTA max | `EmptyState` usages (`profiles.empty`, `resources.noProfile`, `links.empty`) |

## D. Visual system

| # | Criterion | How to check |
|---|---|---|
| D1 | All spacing/radius/color comes from tokens — zero literal px/hex in feature CSS | grep `[0-9]+px|#[0-9a-fA-F]{3,8}` in `src/features/settings/ui/*.module.css` and `src/shared/ui/*.module.css` (excluding token defs) |
| D2 | One surface recipe for choice-lists: Select / SearchableSelect / Menu share bg + radius + shadow | compare `.menu` rules in the three module.css files vs `Popover.variant=menu` |
| D3 | Interactive affordance consistent: toggles = pill, choices = segmented/select, actions = buttons/menu | screenshots per section |
| D4 | Typography uses Heading/Text variants — no raw font-size in feature CSS | grep `font-size` in feature module.css |

## E. Layout & responsive

| # | Criterion | How to check |
|---|---|---|
| E1 | No document-level horizontal overflow at 320px | `document.documentElement.scrollWidth <= clientWidth` |
| E2 | Long content truncates with ellipsis rather than wrapping awkwardly or overflowing | `text-overflow`/`min-width:0` on flex children; screenshots |
| E3 | Rows stay single-line-height when possible; stacked layout only where control needs full width | screenshots at 320/600 |
| E4 | Section rhythm consistent: equal top spacing between sections, hairline between dense rows | screenshots — measure gaps |
| E5 | No dead space: elements don't reserve room for content that only sometimes exists | screenshots — look for gaps where empty children would be |

## F. Components & states

| # | Criterion | How to check |
|---|---|---|
| F1 | Every control exposes its state in the DOM (`aria-checked`, `aria-expanded`, `disabled`, `aria-selected`) | DOM probe per control type |
| F2 | Selected/active state uses the shared selected recipe (`primary-subtle`), not ad-hoc colors | computed style of selected option/segment/radio |
| F3 | Disabled controls dim via `--opacity-disabled` AND carry `disabled`/`aria-disabled` | toggle a parent → child control state |
| F4 | Menus flip when near viewport edge instead of clipping | open last select on page → menu rect vs trigger rect |
| F5 | Focus ring visible on every focusable element (2px primary, `:focus-visible`) | Tab through a section — screenshots |
| F6 | Destructive actions are marked (danger styling / confirm dialog) | profile delete menu item, dict-link delete flow |

## G. Motion & feedback

| # | Criterion | How to check |
|---|---|---|
| G1 | All transitions use `var(--duration-*)` + `var(--ease-*)` tokens | grep `transition` in module.css |
| G2 | `prefers-reduced-motion` collapses transitions to ~0 | emulate media → computed `transition-duration` |
| G3 | No animation on layout-critical properties (height/width/top) without need | grep `transition.*height\|width\|top\|left` |

## H. Accessibility

| # | Criterion | How to check |
|---|---|---|
| H1 | Every form control has a programmatic name (`aria-label`/`aria-labelledby`/`label`) | DOM probe: list focusable elements without accessible name |
| H2 | Popups (`role=listbox`, `role=menu`) have accessible names | `aria-labelledby`/`aria-label` on the popup element |
| H3 | Listboxes use `aria-activedescendant`; options carry `aria-selected` | DOM probe on open menu |
| H4 | Reveal flows move focus into the revealed content (inline forms, dialogs) | click New profile/Edit → `document.activeElement` inside form |
| H5 | Touch targets ≥ `--touch-target` where the platform expects it (toggles, icon buttons) | computed border-box of switches/buttons |
| H6 | Contrast ≥ 4.5:1 body text, ≥ 3:1 secondary/large text, light + dark | computed color vs resolved bg |
| H7 | Icon-only buttons have `aria-label` | DOM probe on `.iconButton`/`aria-haspopup` triggers |

## I. Craft & polish

| # | Criterion | How to check |
|---|---|---|
| I1 | No stale/dead CSS classes referenced in markup or orphaned in modules | grep class names both directions |
| I2 | No `data-testid`/`data-cell-id` convention mixing without reason | grep in `src/features/settings/ui` |
| I3 | Error/validation copy is specific and actionable | trigger validation (empty profile name, bad dict-link URL) |
| I4 | Light and dark themes both pass all visual checks — no hardcoded light-only colors | dark screenshots |

## J. SSOT & maintainability

| # | Criterion | How to check |
|---|---|---|
| J1 | Shared problems fixed in shared components/tokens, not local patches | review recent UI commits — local overrides of shared behavior? |
| J2 | No duplicated recipes across feature CSS that should live in `src/shared/ui` | grep repeated blocks (menu surfaces, focus rings) |

## Scoring

- Sum per category; report `score/max` per category + total.
- **Verdict**: ≥90% ship-quality · 75–89% minor polish list · <75% needs another design pass.
- Every 0 or 1 requires a one-line finding: question → evidence → suggested fix location (file + selector/prop).
