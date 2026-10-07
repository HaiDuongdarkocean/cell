# Design review — up-visual-system-convergence ("Registry Lock")

DESIGN stage, `all` mode. Judge = vision-reader proxy (rendered screenshots + computed-style evidence). Scope = design-system faithfulness only; this review does not redesign.

## Evidence

Rendered mockup `src/entrypoints/mockup-up-visual-system-convergence/` served by `vite --mode mock` on port 5222 (matching the `up-settings-subnav` precedent — `--mode mock` serves the same entrypoint without the crx-plugin `dist/` race). Captured with Playwright Chromium against the dev URL directly (browser_preview proxy unreliable on Windows):

- `tmp/up-visual-system-convergence/mobile-dark.png` — 390px, dark, converged
- `tmp/up-visual-system-convergence/mobile-light.png` — 390px, light, converged
- `tmp/up-visual-system-convergence/desktop-dark.png` — 1280px, dark, converged
- `tmp/up-visual-system-convergence/desktop-light.png` — 1280px, light, converged
- `tmp/up-visual-system-convergence/mobile-dark-current.png` + `desktop-light-current.png` — shipped dialects side for comparison
- `tmp/up-visual-system-convergence/menu-open-converged-dark.png` — real `Menu` opened (anchored, opaque, bordered)

Computed-style evidence (Playwright `getComputedStyle`, converged board):

| Check | Result |
|---|---|
| Checked `MenuItem` (`aria-checked`) background | `rgba(91,163,232,0.12)` = `primary-subtle` (R-SEL-LIST) |
| Real `Menu` popover border | `1px solid rgb(48,48,48)` = `border` — was `transparent` before the `popover.border` decision |
| `Surface panel` shadow / border | `0 10px 15px -3px rgba(0,0,0,.08)` = `shadow-modal` + `1px solid rgb(48,48,48)` |
| `.secondary` "Sync now" border | `1px solid rgb(48,48,48)` visible (current: `rgba(0,0,0,0)` — the disabled-costume defect) |
| Status chip | `chip-status-known` pastel pair |
| `EmptyState` `role="status"` present | yes |
| Board | 9 sections, all R-* registries represented |

## Token-level finding during render

`component.popover.border` resolves `"transparent"` in every theme block (`tokens.json:703` → `tokens.css` `--popover-border: transparent` ×10 presets). `Popover.module.css:8` declares `border: var(--border-width-hairline) solid var(--popover-border, var(--color-border))` — the hairline rule exists but paints transparent, so every `Menu`/`Popover`/`Surface variant="popover"` is effectively borderless today. AC-3 requires a *visible* hairline on every floating surface. DESIGN resolved this the same way as the panel edge: **`popover.border → var(--color-border)`**, one leaf, all ten presets, no rule edit. Recorded in brief §R-FLOAT and mapping.

## Judgment (per `all-mode-vision.md`)

1. **Surfaces** — every converged specimen is a solid token fill: `primary-subtle` selections, `surface-elevated`/`field-solid` floats, `surface` secondary buttons, `chip-status-*` pastel chips. No `overlay-*`/`field-hover` washes, no glass/blur. PASS
2. **Shape** — menus `radius-md`, cards/dashed boxes `radius-lg`, pills on chips/controls; the mixed-radius dialect (`radius-md`/`radius-xl`/`radius-md`) collapses to one `radius-lg` family. PASS
3. **Typography** — uppercase group-header dialect replaced by `SectionHeader` (Heading size 3 + secondary subtitle); body on the token scale. PASS
4. **Touch targets** — `MenuItem` `min-height: var(--touch-target)`, control buttons ≥ `touch-target` in the shell; specimens not cramped at 390px. PASS
5. **States** — checked tint, destructive row, destructive-ish `errorSubtle`, enabled-secondary border, status pastels, empty anatomy, disabled costume cured (secondary now visibly enabled). PASS
6. **Deviations vs shipped UI** — every deviation is the spec's intent (the dialect being retired); none unintended.

## Deviation table

| Deviation | Severity | Note |
|---|---|---|
| Dashed-box replicas show rest state only; drag-active variants (`.dragging` accent, drop-zone emphasis) not animated in mockup | P2 | Recipes unchanged from production; DELIVER keeps existing active rules, only radius/border retokenize |
| `HintIcon` converged hover previewed via scope override, not a shipped atom edit | P2 | Mirrors the exact CSS DELIVER applies (`surface-hover` rest hover, accent on `[data-hint-open]`/focus) |
| `.secondary` previewed via `--button-solid-border` override on the real atom | P2 | Same mechanism DELIVER ships (the atom already reads that var in its `box-shadow` rule) |
| Track strengthening shown as replica bars (15% vs 25% text-mix) | P2 | `--color-track` consumers (Slider/Progress/Toggle) get the token value change; no per-site rule |
| `MenuItem`/`MenuSeparator` are exports of `Menu.tsx`, not standalone files — linter counts `Menu` only | P2 | Mapping rows use `Menu`; the item-level recipe is documented in the brief |
| Real production panel not mounted beside the board — atoms are the real components; divergent sites are exact-rule replicas | P2 | A full-panel mount can't express pre-convergence vs converged states in one viewport; the spec's comparison need is met by the `current` concept built from production rules (`VocabularyTab.module.css`, `LanguageProfilePanel.module.css`, `Menu.module.css`) |
| `status` prop on `Chip` is an API addition | P2 | Flagged in brief + mapping: `DESIGN.md §10.2` lifecycle — showcase + unit test at DELIVER, `experimental` until second consumer |

## Open gates handed to DELIVER (documented in brief, not resolved here)

- SegmentedControl `filled`/`chips` → `accent` contrast gate: if `primary-subtle` fails AA on the segment track, keep solid-primary as a documented variant.
- `--universal-panel-tool-row-*` token retirement is spec-sanctioned but flagged "ask-first" (NFR boundary item).
- `Button .secondary` atom change touches ~60 call sites / 40 files incl. subtitle consumers — subtitle split-view re-verification required (`docs/specs/subtitle-split-view-ac.md`); no subtitle files edited.
- AC-4 bright-page capture: the mockup demonstrates `border` visibility on `#f4f4f5` backdrop; DELIVER must still capture the real panel on a bright page to close the gate.

## `check-design-brief`

`node scripts/check-design-brief.mjs up-visual-system-convergence` → `design brief ok — 75 tokens, 23 components, 14 icons` → `VERDICT: PASS` (exit 0).

VERDICT: PASS
