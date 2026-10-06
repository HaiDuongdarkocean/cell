# Spec Review — up-mobile-chrome

Single-pass BA/PO/TL review. All file:line citations re-verified against live source (spec cites accurate: `NavItem.module.css:95-103` pill recipe, `mountOrbitalBadge.ts:160` unconditional display-restore, `BottomSheet.tsx:28,97,108-115`, `MobileSheet.tsx:82-85` + `HEADER_ROW_HEIGHT_PX:18`, `UniversalPanel.module.css:80-84/106-116`, `UniversalPanelBottomNav.tsx:29-36,88-116`, full `panel.tab.*` keys en+vi at `:1035-1044`, `cardCreator.title` `:243`, `PanelMountController.onOpenChange?` at `panelBridge.ts:11`).

## Scrutinized decisions — all hold

- REQ-1 demotion mechanism fully specced: demoted tabs → Tools `BottomSheet` nav rows reusing `toolsList`/`toolRow` (`:94-115`), `onTabChange`+close, ≤2 taps. No orphaning — panes render from the `UniversalPanel.tsx` registry, not the nav `TABS`.
- REQ-2 correctly *ports* the pill recipe as CSS (avoids the `.horizontal` label-hiding trap at `NavItem.module.css:119-121`); reuse-not-invent respects item-33 boundary.
- REQ-5 resolves the 600–839 hybrid: fullscreen remap pinned as primary, card model recorded DESIGN decision, hybrid explicitly disallowed. `dvh`→`svh`/`100%` fallback + fork-verification mandate is sane.
- REQ-6 handles the `:160` fullscreen trap correctly: suppressed flag consulted by `onFullscreenChange` restore, rides the existing channel, iframe-fullscreen branch preserved. `onOpenChange` listener exists → wiring feasible.
- REQ-8 honors the N7 correction verbatim (mid-row slicing in the `75vh` scroll region, padding exists).
- Deps `31←{28,30}` declared as hard sequencing; REQ-7/REQ-8 consume-not-derive correctly.

## Blockers

none.

## Major

none.

## Minor

1. [REQ-1 alt vs AC-2] [PO]: REQ-1 makes the demoted row's active marking optional ("may mark itself active") while AC-2 requires the active demoted tab identifiable via "header title + sheet row state" — if the row state is optional, identifiability rests on the header alone. Fix: make row `aria-current` mandatory, or reword AC-2 to "header title (and optionally sheet row state)".
2. [REQ-2/REQ-1] [BA]: when a demoted tab is active, no bar item carries the positional indicator — the Tools button is unmarked, so bar-level orientation vanishes. Header title covers it per REQ-3/AC-2, but spec should say so explicitly so DESIGN doesn't accidentally mark Tools as active or leave it ambiguous. Fix: one rule line — "when the active tab is demoted, the bar shows no indicator; orientation is carried by the header title (and the sheet row state)".
3. [REQ-5] [TL]: "the overlay/panel track `100dvh`" is loose — the overlay is `absolute;inset:0` inside the `fixed;inset:0` host, so `dvh` there is a no-op; the unit must land on `.panel` height (and the host only if a fork requires). Fix: clarify "dynamic-viewport sizing applies to the `.panel` frame height; overlay stays `inset:0`".
4. [REQ-6] [TL]: spec says suppression "rides panel open state" without naming the channel — `PanelMountController.onOpenChange?` (`panelBridge.ts:11`) already exists; cite it so the implementer doesn't poll `isOpen()`. Fix: add the citation.
5. [REQ-8] [TL]: consuming item 30's floor assumes that floor reaches `BottomSheet`'s `size="sm"` close — intent's scope-out lists MobileSheet handle/Toggle/inputs, not BottomSheet close. Postcondition still binds ≥44px, but state explicitly: "if item 30 ships no BottomSheet-close mechanism, this item applies the floor token/pattern directly (applying ≠ re-deriving)". Same class for REQ-7's peek-overlap reliance on item 28 — ordering is declared so it can't land first; bounded.

## Nhận xét theo role

- BA: Opens with a real user problem on the persona's primary device class; non-goals carve siblings 28/29/30/32/33 cleanly; every REQ traces to N1–N9 and TO-BE steps.
- PO: All 9 REQs carry actor/goal/precondition/basic/alt/exception/postcondition; ACs 1–11 are numeric and testable at 320/390/600–839/≥840 in en+vi with a defined evidence bar.
- TL: Reuse-only discipline holds (zero new components); actor↔system boundary clean; failure modes (fork `dvh` gap, fullscreen race, locale overflow, narrow header) all have exception paths.

## Action items

1. Tighten REQ-1 alt vs AC-2 active-row optionality — REQ-1/AC-2.
2. Explicit rule for "no bar indicator while demoted tab is active" — REQ-2.
3. Clarify `dvh` target element (`.panel`, not the `inset:0` overlay) — REQ-5.
4. Cite `PanelMountController.onOpenChange` as the suppression channel — REQ-6.
5. Fallback clause if item 30's floor doesn't reach BottomSheet close — REQ-8.

## Risks chấp nhận

- `dvh` reliability on Kiwi/Quetta/Edge forks — documented `svh`/`100%` fallback + mandated fork smoke test; revisit if AC-6 fails on a real fork.
- Demoted pair (playlist+recap) unconfirmed until DESIGN measures vi labels — bounded cost (≤2 taps back).
- Card-model alternative for 600–839px — gated behind "Ask first" + recorded decision.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. REQ-1 alt flow: demoted-row active marking made mandatory — "the row marks itself active via `aria-current`" (consistent with the nav bar), keeping AC-2's "header title + sheet row state" verbatim.
2. REQ-2 Rules: added "when the active tab is demoted, the bar shows no indicator — orientation is carried by the header title (and the sheet row state); the Tools button is not marked active."
3. REQ-5: `dvh` target clarified — basic flow step 2 and Rules now pin dynamic-viewport sizing to the `.panel` frame height (host only if a fork requires); overlay stays `absolute;inset:0` inside the `fixed;inset:0` host, `dvh` there named a no-op.
4. REQ-6 Rules: suppression channel cited — subscribe via `PanelMountController.onOpenChange?` (`panelBridge.ts:11`), never poll `isOpen()`.
5. REQ-8 Rules: fallback clause added — "if item 30 ships no BottomSheet-close mechanism, this item applies the floor token/pattern directly (applying ≠ re-deriving)". REQ-7's peek-overlap reliance on item 28 verified already covered by the declared `31←{28,30}` ordering (spec line 4 + REQ-7 Rules) — no edit needed.
