# Analyze-Gate Review — `docs/intent/up-settings-subnav.md`

**Mode:** `all` · **Reviewer:** fresh-context adversarial audit (did not author the doc)

## 1. Evidence spot-checks (~20 citations)

All held. Verified exact: `SettingsTab.tsx:79` (`navMode="horizontal"` forced); `NavItem.module.css:119-121` (`.horizontal .label{display:none}`) + `NavItem.tsx:48` (`title={tooltip}` — never fires on touch); `SettingsDialogContent.tsx:196` (`tooltip={item.label}`), `:139` (`containerWidth < BREAKPOINTS.medium` → horizontal, `tokens.ts:118` medium=600), `:140` (`SIDEBAR_LABEL_MIN_WIDTH`=768), `:153-167` (13 `sidebarItems`), `:124-137` (`ResizeObserver`), `:177` (`collapsed` wiring); 13 `settings.nav.*` keys in both `en.json:7,402-413` and `vi.json:7,402-413`; `Navigation.tsx:85-156` scroll-sync machinery (`clickScrollingRef` guard, rAF throttle, auto-center `:49-53`); `Tabs.tsx:53-80` (tablist + arrow-key nav); `Tabs.module.css` carries no overflow rules; `StudyModeActionBar.tsx:108,153` scroll-arrow precedent; `Sidebar.module.css:43-46` (`.collapsed` = `--space-16` 64px rail → `NavItem` `@container (width <= 64px)` kills labels); `Navigation.module.css:34` (`overflow-x:auto` already, no affordance); `product-backlog.md:66-68` (items 31/32/33 + dep list).

## 2. Defects found (all applied — see `## Applied fixes`)

- **D1 (material):** six citations pointed at ephemeral `03-visual-desktop.md`/`03-visual-mobile.md` line numbers — dead anchors (Need row, N1, N2, N5, Journey AS-IS 1+3); durable source is `docs/audits/20261006-universal-panel-ux-audit.md:41` (V-8/M-7) + `:16` root-cause 5.
- **D2 (material):** N2 quoted "left/right items clipped mid-glyph with no fade cue" as verbatim audit text — the durable audit says only "edges clip mid-glyph" (:41); Risks cited "~1099px per V-8 risk note" — no such figure exists in the durable audit.
- **D3 (material):** scope contradiction — `navMode='auto'` at container width 600–767px renders `vertical`+`collapsed` (`SettingsDialogContent.tsx:139-140,177`) → `NavItem` `@container (width <= 64px)` hides labels entirely, i.e. the exact icon-only defect N1/AC1 ban, while Non-goals excluded touching `NavItem` collapsed behavior.
- **D4 (minor):** blast-radius row named the wrong atom — bottom nav renders `Button orientation="vertical"` (`UniversalPanelBottomNav.tsx:56-69`), not `NavItem` (strengthens the claim: `NavItem` blast radius is even smaller).
- **D5 (nit):** i18n cites gave only `en.json:7`/`vi.json:7` — the other 12 keys live at `:402-413`; `navMode="auto"` cited `:139` without the `:116` prop default.

## 3. Structural checks

- **Journey:** AS-IS 5 / TO-BE 5, narratives ✓; TO-BE lands the promised first-attempt navigation value.
- **Decision:** `go` supported — verified P1 discoverability defect on a primary nav surface, cost S, all ingredients in-repo.
- **`ui_surface: yes`:** correct — user-facing nav presentation change on two surfaces.
- **Stories:** business-level with done-when ✓. **Risks:** realistic (shared-atom blast radius, scroll-sync regression, dual-surface hidden risk).
- **Template completeness:** all required sections; Regulator row answers "none — why" ✓.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. All six `03-visual-*.md` citations re-anchored to `20261006-universal-panel-ux-audit.md:41` (V-8/M-7), with `:16` (root cause 5) added in the Need row.
2. N2's unverifiable verbatim quote replaced with the audit's actual wording ("edges clip mid-glyph"); `~1099px` in Risks tagged `[assumption]` — the durable audit cites no figure.
3. 600–767px contradiction resolved by committing the design to label that band — Non-goals now carries a boundary note directing the horizontal cutoff to extend to `<768px` inside `SettingsDialogContent` (`:139-140`, in-scope), leaving `NavItem` collapsed rules untouched. Chosen over qualifying N1/AC1 to the strip only, because icon-only in that band is the very defect this item exists to fix.
4. Blast-radius row corrected: `NavItem orientation="vertical"` → `Button orientation="vertical"`, cite widened to `UniversalPanelBottomNav.tsx:56-69`.
5. Nits: `en.json:7`/`vi.json:7` → `:7,402-413` (both locales, Context row + N5); `SettingsDialogContent.tsx:139` → `:116,139` for `navMode="auto"`.
