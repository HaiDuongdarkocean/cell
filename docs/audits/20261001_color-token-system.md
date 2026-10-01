# Technical Debt Audit — Color token system

**Scope:** `src/shared/styles/tokens.json` + `src/shared/styles/tokens.css` (generated) + `src/shared/lib/tokens.ts` + `src/shared/lib/colorGenerator.ts` + every `var(--color-*)` usage in `src/**/*.css`.

**Why now:** Anki-import picker rows looked pre-hovered; root cause was a runtime/static formula drift on `--color-surface-hover` (fixed in `77807f21`). The same class of bug exists for **6 more tokens**, and the naming layer has aliases + transparency traps that keep producing wrong-color choices.

---

## Summary

- Items found: **8** | High score (≥4.0): **2** | Quick wins: **3** | Pay-down: **2** | Watch: **3**
- ~140 derived color keys per mode; ~30 of them are shadcn-era aliases resolving to ~10 unique values.
- `applyTheme` writes **inline** CSS vars on `<html>` for every install (default preset `dawn` ⇒ `deriveColorTokens` always runs — the `!preset` precomputed fast-path never triggers in production). So `deriveColorTokens` is the *de facto* source of truth, not `tokens.json`.

## Inventory

| # | Location | Type | Description | Vel | Risk | Reach | Cost | Score |
|---|----------|------|-------------|-----|------|-------|------|-------|
| 1 | `tokens.ts deriveColorTokens` | Architectural | Runtime formulas ≠ static `tokens.json` for 6 keys still unfixed (see drift table) | 4 | 5 | 5 | 2 | **4.55** |
| 2 | `tokens.json derived.*` | Architectural | `muted` = `accent` = `secondary-hover` = `surface-hover` — ONE value serving BOTH "resting muted fill" (Skeleton, Avatar, Checkbox, Progress, Code, Blockquote) AND "hover feedback" (61 files). Can't tune one without the other | 4 | 4 | 5 | 4 | **3.90** |
| 3 | `color-field*` ladder | Code quality | Two parallel ladders: transparent (`field`/`field-hover`/`field-active`) vs `-solid` (`field-solid`/`field-hover-solid`). Name gives zero transparency signal; `-solid` used by only 1–2 files → agents reach for the wrong one (caused the transparent Select menu bug) | 3 | 4 | 3 | 3 | **3.35** |
| 4 | module CSS hardcodes | Code quality | 94 hardcoded `#hex` + 61 `rgba()` across `*.module.css` — bypass presets/custom themes | 3 | 4 | 3 | 4 | **3.20** |
| 5 | `overlay-*` prefix | Code quality | Same prefix, 3 unrelated meanings: `--color-overlay` (scrim 56%), `--color-overlay-hover/-pressed` (text 4–8% wash), `--overlay-*` static (panel metrics) | 3 | 3 | 3 | 2 | **3.15** |
| 6 | Missing token | Architectural | No semantic for "control resting on an elevated surface" → `.pickRow` grabbed `surface-elevated` (= dialog bg ⇒ rows looked hovered) | 4 | 3 | 3 | 2 | **3.15** |
| 7 | shadcn alias soup | Code quality | `input`=`border`, `ring`=`primary`, `secondary`=`surface`, `info`=`primary`, `text-muted`=`muted-foreground`=`text-secondary`, `on-accent`=`accent-foreground`=`text`. DESIGN.md even bans `accent` for hover while `accent` === `surface-hover` | 3 | 3 | 3 | 3 | **3.00** |
| 8 | component tokens | Code quality | `button-overlay-bg` `rgba(10,16,26,.72)`, `overlay-fg` `#F7F8F8`, `success-hover-bg` `mix(success,#000 10%)` — theme-bypass at component layer | 2 | 3 | 2 | 2 | **2.65** |

Score = 0.30·velocity + 0.35·risk + 0.20·reach + 0.15·(6−cost)

## Item 1 — remaining runtime/static drift (verified by recomputation, dawn/dark palette)

| Token | tokens.json (static) | deriveColorTokens (runtime) | Verdict |
|---|---|---|---|
| `primary-hover` | `mix(primary, text 8%)` → `#6a75d4` | `shade 10%` → `#555fbd` | **Wrong direction** — lift vs darken |
| `primary-active` | `mix(primary, text 16%)` → `#7680d7` | `shade 20%` → `#4b55a8` | **Wrong direction** |
| `border-subtle` | `mix(border, transparent 35%)` — translucent | `shade(surface, 5)` → `#1f1f1f` — solid | Alpha + color differ |
| `destructive` | `#C93B3B` | `shade(error,45)` → `#762626` | Runtime much darker |
| `destructive-hover` | `#B03535` | `shade(error,55)` → `#601f1f` | Same |
| `text-inverse` | `#0F1011` | `colors.background` `#111111` | Near-identical today, drifts on custom palettes |

(`success/warning/error-subtle`, `*-muted`, `info-subtle` also approximate rather than mirror the static formulas.)

Because `dawn` is the default preset, the runtime values above are what **every user** actually paints — the static CSS var is overridden by the inline var on `<html>`.

## Item 2 — the semantic collision map (why "muted" is a trap)

One physical value (`surface-hover`) is reachable via 4 names and serves 2 opposite purposes:

```
--color-surface-hover ──┬── hover feedback (menu items, rows, buttons… 61 files)
--color-muted           ├── RESTING fills: Skeleton, Avatar, Checkbox unchecked,
--color-accent          │   Progress track, Code, Blockquote, Thumbnail, Chip
--color-secondary-hover ┘
```

Consequence: designers pick `muted` for "a quiet background" and `surface-hover` for "hover", not knowing they're identical — so hover strength is coupled to resting-fill brightness forever. The fix for `.pickRow` (`rest: surface` + `hover: surface-hover`) is correct only because hover now lifts; if a preset makes hover darker, every Skeleton/Checkbox gets darker too.

## Item 3/6 — the transparency trap + missing rung

```
Resting ladder (solid):  surface < surface-elevated (= dialog/popover bg)
Hover wash (alpha!):     field → field-hover → field-active        (text @14/19/24%)
Hover wash (solid):      field-solid → field-hover-solid           (over elevated)
Overlay wash (alpha!):   overlay-hover → overlay-pressed           (text @4/8%)
Interaction on surface:  surface-hover → surface-pressed           (lift ladder)
```

`field-*`/`overlay-*` are **washes** (alpha) — painting them as a panel/menu/row background makes it translucent over whatever's beneath. `*-solid` exists but only 2 files know about it.

There is no token for "inset control resting ON an elevated surface" — `.pickRow` needed exactly that and reached for `surface-elevated` (which IS the dialog bg → invisible/hover-look). Today `surface` serves the role, but nothing in the name ladder says so.

## Business impact (top 3)

1. **Derive drift (#1)** — every future preset/custom-color change silently re-colors hover, borders, destructive buttons app-wide; the bug class that produced this week's picker-row defect. Fixes with ~10 lines + already-shipped `mixHex`.
2. **Alias collision (#2)** — blocks any design iteration on hover intensity (touch `surface-hover` = retint every muted fill in the app). Roughly doubles the review burden on any visual polish PR.
3. **Transparency trap (#3)** — each misuse ships a see-through panel/menu; cost is a Chrome-session debug + fix cycle per occurrence (2 this week alone: Select menu, pickRow).

## Roadmap

1. **Quick win (this sprint):** finish mirroring the remaining 6 drifted formulas in `deriveColorTokens` via `mixHex`/`rgbaVar`; extend `tokens.test.ts` to assert runtime≈static for every key on the default palette. *(cost 1–2)*
2. **Quick win:** add the color-selection cheat sheet below to `DESIGN.md` so the pick-table is the first thing an agent reads.
3. **Quick win:** rename-or-document the `field*` family — minimum: docstring "TRANSPARENT wash — never use as floating surface" in tokens.json + prefer `*-solid` for anything opaque.
4. **Pay-down:** split `muted` (resting fill) from `surface-hover` (interaction) into two values; migrate the 12 resting-fill usages off `muted`/`accent`. Schedule over 2 sprints; it's a breaking semantic change → `MIGRATION.md` entry.
5. **Pay-down:** alias deprecation — pick canonical names (`surface-hover`, `text-secondary`, `border`, `primary`), mark `accent`/`muted`/`secondary-*`/`text-muted`/`muted-foreground`/`input`/`ring` deprecated in token metadata, migrate via codemod.
6. **Watch:** module-CSS hex/rgba sweep (biggest count lives in mockups/showcase — exclude `src/entrypoints/mock-*`/`design-system-showcase` from the burn-down target).
7. **Watch:** `overlay-*` rename to `wash-*` can ride along with #5.

## Token selection cheat sheet (appendix — candidate for DESIGN.md)

| Intent | Token | Never |
|---|---|---|
| Page/dialog base | `background` / `surface-elevated` | `surface-hover`, `muted` |
| Resting control ON a surface | `surface` (inset) | `surface-elevated` (= popup bg → looks hovered), `field` (transparent) |
| Hover/pressed on that control | `surface-hover` / `surface-pressed` | `field-hover` (alpha), `overlay-hover` (alpha) |
| Translucent input fill | `field` / `field-hover` / `field-active` | anything as a *floating panel* bg |
| Floating panel (menu/popover/select list) | `surface-elevated` or `field-solid`/`field-hover-solid` | `field`, `field-hover`, `overlay-hover` |
| Quiet fill (skeleton, code block, checkbox-off) | `muted` *(today = surface-hover)* | — |
| Scrim behind modal | `overlay` | `overlay-hover` (it's a wash, not a scrim) |
| Text | `text` / `text-secondary` / `text-tertiary` | `muted-foreground` (alias) |
| Border | `border` / `border-subtle` / `border-emphasized` | `input` (alias), `border-inverse` |

Rule of thumb: **`-hover`/`-pressed`/`field`/`overlay-*` = alpha wash or interaction state; `-solid`/`-elevated`/`surface*` = opaque.** If a token name doesn't say which, check `tokens.json` — if its value contains `transparent`, it will let the layer below show through.
