# Design Review — up-settings-subnav

> Brief: `docs/intent/up-settings-subnav-design-brief.md` · Mapping: `docs/intent/up-settings-subnav-component-mapping.md`
> Mockup: `src/entrypoints/mockup-up-settings-subnav/` · Evidence: `tmp/up-settings-subnav/*.png` + DOM verification log
> Mode: `all` — vision-reader proxy executed via code-level DS conformance + rendered-DOM measurements (Playwright). Screenshots captured for human spot-check.

## What was verified

Rendered mockup served by `vite --mode mock` on port 5220 (the crx-plugin dev mode crashed twice on an unrelated `dist/` ENOENT race; mock mode serves the same entrypoint without it). Twelve stage screenshots: target + real at 320/390/700/960/full, dark + light, en + vi, plus a mid-scroll both-edges state.

DOM measurements (Playwright evaluate, target concept):

| Check | Result |
|---|---|
| Item count | 13 `data-section-id` items in the strip |
| Label rendering | `.tLabel` spans have size (e.g. "General" 45×14, `w=700 vi` widest item 145px); all single-line (`offsetHeight <20`, `nowrap`) |
| Item recipe | `gap: 8px` (spacing-2), `padding-inline: 12px` (spacing-3), `min-height: 40px` (touchTarget-desktop) — matches the chosen labeled-item values |
| Overflow state machine | at bound `scrollLeft=0` → only right arrow renders; mid-scroll → both arrows + combined `mask-image` gradient; `mask` observed `linear-gradient(...)` per edge |
| Arrow paging | click → `scrollBy` delta `258px` = `0.75 × 344px` clientWidth at click time (arrow mount shrinks track to 300px) — spec behavior confirmed |
| Active state | click item → `aria-current="true"` + underline pill `opacity:1`; spy marks active on content scroll (bottom → `theme`) |
| i18n | `nav aria-label` = "Settings sections"; vi shot renders "Chung"…, arrow aria "Cuộn các mục sang phải" |
| Height budget | strip bar `49px` ≤ `touchTarget + spacing-2 × 2` (56/60) |
| Theme flip | dark shots mean luminance ~34, light ~252; 200+ distinct colors — real content, both themes |

Real panel (shipped `SettingsDialogContent`, `navMode="auto"`) rendered live for comparison: 390px → icon-only strip; 700px → collapsed 64px rail (`[data-collapsed]`, nav width 63px); 960px → labeled vertical sidebar (labels visible). Confirms the AS-IS defect bands the variant removes.

## Vision-faithfulness assessment (all-mode-vision checklist)

1. **Surfaces** — solid token surfaces only: `color-surface` bar, `color-divider` hairline, `color-surface-hover` item hover, `color-primary` active mark. No glass/blur anywhere. ✅
2. **Shape** — items keep `radius-pill` (the existing NavItem shape, not a new one); arrows are `Button shape="circle"`. No off-system radii. ✅
3. **Typography rhythm** — label = `font-size-xs`/`font-weight-medium`/`leading-tight`, identical to the `.vertical` labeled recipe — same rhythm as sibling nav surfaces. ✅
4. **Touch targets** — items `min-height/min-width: var(--touch-target)` (40px desktop); arrows `min-block/inline: var(--touch-target)`. ✅
5. **States visible** — hover (`surface-hover`), active (`aria-current` → primary + pill), `:focus-visible` ring, edge fades + arrows conditional on overflow; disabled opacity inherited from `.item`. Reduced-motion honored via existing media queries. ✅
6. **Deviations vs shipped panel** — intended diffs only: labels visible, arrows + fades added, 600–767 band labeled. No accidental restyle (vertical/collapsed rules untouched in the design).

## Deviations / severity

| Deviation | Severity | Note |
|---|---|---|
| Mockup re-implements the item markup (`.tItem`) instead of importing `NavItem` — `.horizontal .label{display:none}` cannot be overridden from outside the module | P2 | Wireframe copies the post-change recipe verbatim; real panel still mounted for side-by-side — comparison preserved |
| vi strip is ~35px wider than en at 700 (scrollW 1529 vs 1494) | P2 | Expected locale variance; handled by the same overflow rule — no truncation |
| `vite` dev mode crashed twice on unrelated `dist/` ENOENT race (crx plugin) | P2 | Worked around with `--mode mock`; screenshots unaffected |

None break the primary job (identify + reach a section by name).

VERDICT: PASS
