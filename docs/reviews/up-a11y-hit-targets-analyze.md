# Analyze-Gate Review — `docs/intent/up-a11y-hit-targets.md`

**Slug:** `up-a11y-hit-targets` · **Mode:** `all` · **Reviewer:** fresh-context adversarial audit (did not author the doc)

## 1. Evidence spot-checks (~15 citations) — all held

Verified exact: `useFocusTrap.ts:29-41` (`getRootNode()` host-root lookup; `offsetParent !== null` filter used for cycling at `:41` but not the initial pick at `:34-35`); `UniversalPanel.tsx:207-211` (BottomNav rendered DOM-first) + `:275-290` (panes are plain `<div hidden>`); `UniversalPanelBottomNav.module.css:5` (`display:none` desktop) + `UniversalPanel.module.css:80-84` (`column-reverse` ≤839px → visual-last/DOM-first inversion); `VocabularyTab.module.css:118-119` (`.statusBadge` `min-height:0;height:var(--space-5)` = 20px); `PlaylistTab.tsx:199` (`aria-live="polite"` on each card `role="listitem"`); `StudyModesTab.tsx` (`:134` presets `role="radiogroup"`, `:163` customs `role="group"`, `:244` `ModeCard` `role="radio"`, `:329-337` `Toggle` `role="switch"` gating `advanced-settings` without `aria-expanded`/`aria-controls`); `CollapsibleSidebar.tsx:83` + `UniversalPanelBottomNav.tsx:63` (`aria-current`-only NavItems); `DictionaryPanelView.tsx:216-233` (only self-focusing tab); `STANDARD.md:311-315` (44px coarse / 40px fine floor); `tokens.json:554-557` `touchTarget` 44/40px, `:733-734` iconbutton xs/sm 28/32px, `:765` profile-flag 34px, `:431` space-5 20px, `:452` element-md 32px, `:639` input height `var(--size-element-md)`; `product-backlog.md:65-68` (item rows + deps); audit rows `20261006-universal-panel-ux-audit.md:25/:26/:33/:57-58` (V-1/M-8, F-2, F-4/M-9, semantics batch + M-10).

## 2. Defects found (all applied — see `## Applied fixes`)

- **D1 (minor):** evidence cells cited `loop/` artifacts (`computed-styles.json`, `02-code-audit.md`, `03-visual-mobile.md`) as primary anchors — `loop/` is ephemeral; durable rows in `docs/audits/20261006-universal-panel-ux-audit.md` carry the same numbers.
- **D2 (minor):** `tokens.css` line refs are generated output (`scripts/generate-tokens.js`) — line numbers drift; values must anchor to `tokens.json` SSOT.
- **D3 (nit):** "item 33 depends transitively" — `product-backlog.md:68` lists item 30 as a direct dependency.
- Forward flag (not a defect): `hasTouch: true` alone does not make `@media (pointer: coarse)` match in Chromium — coarse-pointer verification needs a mobile device descriptor (`isMobile`+`hasTouch`, e.g. `devices['Pixel 5']`) or CDP `Emulation.setEmulatedMedia` with `pointer: coarse`; the audit spec has no touch emulation today. AC #1 must not hardcode `hasTouch: true` as the sole mechanism.

## 3. Structural checks

- **Journey:** PASS — AS-IS 5 steps / TO-BE 6 steps, narratives concrete; TO-BE lands the promised value incl. the measured-verification step.
- **Decision:** `go` supported — measured violation inventory + existing e2e harness + cheapest P0-class a11y wins; downstream 31 dependency real.
- **Scope fencing:** PASS — explicit Out mapping to items 28/29/31/32/33; N2 restyle-exclusion consistent with Risks/AC.
- **`ui_surface: yes`:** correct — input min-height bindings genuinely shift layout metrics 32→40/44px across Settings/dictionary rows.
- **Stories:** PASS — business-level with done-when matching ACs.
- **Template completeness:** PASS — all required sections; `[assumption]` marks honest; Regulator row answers "none — why".

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. Need row: `computed-styles.json`/`03-visual-mobile.md`/`02-code-audit.md` refs re-anchored to `20261006-universal-panel-ux-audit.md:25/:26/:33/:57-58`; ephemeral names kept in parentheses marked "ephemeral evidence dir, superseded by audit summary"; token refs swapped to `tokens.json:765/:431/:733-734`.
2. Change row: `tokens.css:148-149,206-209` annotated generated and dual-cited `tokens.json:554-557`; "Token bypass" quote re-anchored to audit `:13`.
3. Solution row: `02-code-audit.md` finding refs re-pointed to audit rows `:26`/`:33`/`:57`; `hasTouch: true` → "emulated coarse pointer".
4. Organization row: "depends transitively" → "declares this item as a direct dependency" (`product-backlog.md:68`).
5. N1: violation inventory re-anchored to audit `:25`/`:33`; all `tokens.css` refs swapped to `tokens.json` (`:431`, `:733-734`, `:765`, `:639,452`).
6. N2/N5/N9: finding evidence re-anchored to audit `:33`/`:57`/`:58` with ephemeral detail refs demoted to parentheticals.
7. Supplier row + Scope-In bullet + N9 + TO-BE journey step 6 + AC #1: `hasTouch: true` removed as the sole mechanism — coarse-pointer verification now specifies `isMobile`+`hasTouch` device descriptor (`devices['Pixel 5']`) or CDP `Emulation.setEmulatedMedia` with `pointer: coarse`, noting the audit spec has no touch emulation today.
