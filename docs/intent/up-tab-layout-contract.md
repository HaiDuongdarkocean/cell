# Intent: up-tab-layout-contract — One tab-layout contract for the Universal Panel's six tabs

> Slug: `up-tab-layout-contract` · Mode: all · Source: backlog row #28 (`docs/ideas/product-backlog.md:63`), findings F-1/F-3/F-5/F-9/F-10/F-19 + M-3 + EmptyState-centering part of V-11/M-14 in `docs/audits/20261006-universal-panel-ux-audit.md`
> ui_surface: yes         ← per-tab layout and padding/surface behavior change what the user sees and can reach; AGENTS requires before/after capture for the gutter/surface deltas
> confidence: high        ← every finding re-verified against source below; audit line refs confirmed (minor ±1 drift on two, noted)

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Users cannot reach content they own (Playlist and Recap ship **no scroll region** — long lists are clipped and unreachable at every viewport, P0); audio keeps playing from a hidden tab after a tab switch; Recap throws away the user's place (refetch + lost scroll/expansion) on every visit; the six tabs behave like different apps — three mounting patterns, ~2× divergent gutters, two surface schemes — because no single layout contract exists | F-1: `PlaylistTab.module.css:1-6` (`.list`: no `overflow-y`, no `flex:1`, no `min-height:0`) + `RecapTab.module.css:1-6` (`.body` identical) inside `UniversalPanel.module.css:43-50` (`.content{overflow:hidden}`); F-3: `PlaylistTab.tsx:217-225` (`<audio autoPlay>` under keep-alive `[hidden]`, `UniversalPanel.tsx:284-286`); F-9: `UniversalPanel.tsx:287` (`{activeTab === 'recap' && recapPanel}` raw mount) + `RecapTab.tsx:201-203` (refetch per mount); F-5: `UniversalPanel.module.css:49,53-58` (`data-cell-id` padding carve-out); F-10: remap ×3 + surface ×4 vs nothing on playlist/recap | high |
| Change | Per-tab ad-hoc layout (three mounting patterns, hand-carved padding, two surface schemes, two missing scrollports, dead responsive rule, no deactivate lifecycle) → one declared tab contract: `.content` neutral/flush, each tab owns padding + owns its scroll region, one surface remap hoisted to `.body`, all six tabs mount identically through `.tabPane`/`visitedTabs`, a bottom scroll inset above the nav, a deactivate lifecycle that stops tab-scoped media, dead `@container` resolved | same evidence; sibling "correct" patterns already in repo: `VocabularyTab.module.css:49-58` (`.list` flex+min-height+overflow), `StudyModesTab.module.css:1-8` (padding+`overflow-y:auto`+surface+remap) | high |
| Solution | Shell-owned contract, not per-tab negotiation: `.content` becomes a uniform flush shell; the `--card-background`/`--color-surface-card` remap moves once onto `.body`; recap joins `.tabPane` + `visitedTabs`; tab CSS owns padding and a `flex:1; min-height:0; overflow-y:auto` scrollport (shadow-root scrollbar via existing `Scrollable.module.css` where applicable); activation state reaches tabs so Playlist can release its preview; the dead `@container` is either activated or removed — decided in SPECIFY | `UniversalPanel.tsx:274-290` (current mixed mounting), `UniversalPanel.module.css:33-50` (shell owns `.body`/`.content` already — the hook point exists), `src/shared/ui/Scrollable.module.css` exists | high |
| Value | Every item a user owns is reachable (P0 repair); no phantom audio from an invisible tab; tabs feel like views of one app; adding a seventh tab inherits correct layout instead of silently getting the wrong padding; this item is prerequisite for 31 (mobile chrome) and 33 (visual convergence) — landing it first shrinks their blast radius | `product-backlog.md:66-68` (deps: 31 ← {28,30}; 33 ← {28,29,30,31,32}); audit exec read `20261006-…-audit.md:12` ("No single tab-layout contract" = root cause #1) | high |
| Stakeholder | Learner persona 5–80 on all devices (reach content, no leaked sound, consistent feel) + maintainers/agents building on the panel (one contract to extend, not three patterns to reverse-engineer) + sibling backlog items 31/33 that restyle these surfaces | AGENTS persona; `product-backlog.md` deps | high |
| Context | MV3 content-script shadow-DOM surface; 94% centered modal desktop → column-reverse phone chrome ≤839px (`UniversalPanel.module.css:80-84`); this is defect-repair + contract, **not** visual redesign — items 31/33 own that; RAM ≥1GB persona bounds the keep-alive cost (recap joining `visitedTabs` keeps one more DOM subtree alive) | AGENTS.md persona + shadow-DOM boundary; `UniversalPanel.module.css:80-116` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Single dev/agent | All mechanics exist in-repo (flex scroll pattern, `visitedTabs`, `.tabPane`, `Scrollable.module.css`, `EmptyState`) — no new dependency, no invention; the work is converging divergence, not designing | high capability; constraint: recap joining keep-alive needs a revalidate-on-activation path (F-9, `20261006-…-audit.md:68`) and deactivation signaling must reach kept-alive panes without prop-drilling churn — smallest mechanism is a spec decision |
| Customer | Immersionist end user, 5–80, any device | Reach every recording/session; sound follows the visible tab; Recap remembers their place; consistent gutters/surfaces so the panel reads as one app | mobile ≤839px + 320px floor must not regress; 200% zoom reachability (STANDARD §10.2) is the real test of the scroll fix |
| Supplier/Dependency | Chrome MV3 runtime, `visitedTabs` keep-alive model, `<audio>` element semantics | `display:none` does not stop `<audio>` — deactivation must be explicit (pause/revoke or conditional render); keep-alive adds DOM weight, bounded by ≥1GB persona | platform behavior is stable; no API risk |
| Organization | Owners of backlog items 29/30/31/32/33 touching the same files | Land order per backlog deps: this item is prerequisite-free and gates 31/33; contract changes `.content`/`.body` that later items restyle — coordination, not code | `product-backlog.md:66-68`; dirty-file/ownership rules in AGENTS apply |
| Regulator | none — internal layout/lifecycle repair; no permission, manifest, API, or store surface touched | none — why: pure surface-internal change | n/a |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Every tab's content must be reachable when it overflows — a scroll region per tab, working at every viewport and under 200% zoom | **F** + U | F-1 verified: `PlaylistTab.module.css:1-6` and `RecapTab.module.css:1-6` carry no `overflow-y`/`flex:1`/`min-height:0` inside `UniversalPanel.module.css:43-50` (`.content{overflow:hidden}`); correct sibling pattern `VocabularyTab.module.css:49-58`, `StudyModesTab.module.css:6`; audit empirical: no scroll region for either tab at any viewport — F-1 (`20261006-…-audit.md:24`; 5-viewport sweep `:3`) | high |
| N2 | Media belonging to a hidden tab must not keep playing — tab deactivation must stop/revoke the playlist preview | **F** + R | F-3 verified: `PlaylistTab.tsx:217-225` `<audio autoPlay>` inside keep-alive `.tabPane` (`UniversalPanel.tsx:284-286`); `[hidden]`→`display:none` only (`UniversalPanel.module.css:68-70`) | high |
| N3 | One mounting pattern for all six tabs — recap must ride `.tabPane`/`visitedTabs` keep-alive like its siblings | **F** + U | F-9 verified: `UniversalPanel.tsx:275-290` wraps five tabs in `.tabPane`+`visitedTabs`; `:287` renders recap bare (`{activeTab === 'recap' && recapPanel}`) → remount per visit, refetch `RecapTab.tsx:201-203`, lost `expandedId`+scroll | high |
| N4 | Recap must preserve the user's place across tab switches while showing fresh data — keep-alive + revalidate-on-activation | U + R | F-9 evidence as above (ID source `20261006-…-audit.md:68`); staleness is the inherent keep-alive risk → revalidate-on-activation | high |
| N5 | One padding ownership model — each tab owns its gutters explicitly; the shell's `data-cell-id` carve-out list (a JS rename silently breaks it; a new tab gets wrong padding by default) is removed | U + **S** | F-5 verified: `UniversalPanel.module.css:49` pads `.content` then `:53-58` zeroes it for 4 named `data-cell-id`s; playlist/recap double-pad → ~28–32px vs 12–16px effective gutters (`PlaylistTab.module.css:5`, `RecapTab.module.css:5`) | high |
| N6 | One surface scheme — the `--card-background`/`--color-surface-card`→elevated remap hoisted once to `.body` so a `Card` renders the same shade on every tab | U + S | F-10 verified: remap written in vocabulary `VocabularyTab.module.css:8-10`, studyModes `StudyModesTab.module.css:8`, settings `SettingsTab.module.css:9-10`; dictionary paints `surface` only (`DictionaryTab.module.css:8`); playlist/recap paint neither — audit counted 4 remap sites, actual is 3 remaps + 4 surface paints (minor audit imprecision, defect unchanged) | high |
| N7 | Every tab scrollport clears the bottom-nav chrome — a scroll-bottom inset so the last row doesn't land flush on the nav hairline | U | M-3 verified: `.panel` `column-reverse` ≤839px (`UniversalPanel.module.css:80-84`) makes nav a flex sibling; audit: no bottom scroll inset above the nav — last rows land on / clip at the hairline (M-3, `20261006-…-audit.md:58`) | high |
| N8 | Narrow-width behavior must be real, not dead code — the playlist `@container (max-width:480px)` never evaluates (no `container-type` ancestor in `universalPanel`); either activate the intended row-wrap or remove the query | **F** + S | F-19 verified: `PlaylistTab.module.css:82-91`; repo-wide grep — `container-type` exists in unrelated entrypoints/features only, none under `universalPanel`/`sessionRecap` | high |
| N9 | Empty states fill the scrollport instead of anchoring top with a 60–70% void | U | M-14/V-11 verified: shared `EmptyState` `.root` (`src/shared/ui/EmptyState.module.css:4-13`) has no `min-height`/fill rule — content hugs top; audit confirms the 60–70% void (`20261006-…-audit.md:51`) | high |
| N10 | Tab-scoped deactivate semantics are part of the contract — not just audio: a tab losing activation has a defined lifecycle signal future tabs inherit (preview cleanup today; keeps recap's revalidate + any future live content honest) | R + S | `[assumption]` — inferred from F-3 fix shape ("pass isActive/deactivate signal") + N4's revalidate need; no second live-media tab exists today | medium |

## Scope

- **In:**
  - `.content` → uniform flush shell: remove the `data-cell-id` padding carve-out (`UniversalPanel.module.css:53-58`); each of the six tabs owns its padding explicitly.
  - Per-tab scroll region: Playlist `.list` and Recap `.body` get `flex:1; min-height:0; overflow-y:auto` (shadow-root scrollbar styling via existing `Scrollable.module.css` where the pattern applies, as `SettingsDialog.module.css:18` does); every other tab verified to already have one.
  - Surface remap hoisted once onto `.body` (`--card-background`/`--color-surface-card` → `surface-elevated`); delete the per-tab copies; one base surface decision (`surface` vs `background`) for all tabs.
  - Recap joins the `.tabPane` + `visitedTabs` mounting pattern (`UniversalPanel.tsx:287` → same as `:275-290` siblings) with revalidate-on-activation for `GET_SESSION_RECAP`.
  - A deactivate/activation lifecycle signal reaching kept-alive tabs; Playlist uses it to stop and clear the preview (`PlaylistTab.tsx:217-225`).
  - Scroll-bottom inset (`padding-bottom`/`scroll-padding-bottom` ≥ `--space-3`–`--space-4` + safe-area where present) on every tab scrollport above the nav hairline.
  - Dead `@container` in `PlaylistTab.module.css:82-91` resolved — activated via `container-type` or replaced by a media query, or removed; dead code does not survive (conservative lean: activate — the wrap intent is evident and the hang-indent `calc` was written for it; SPECIFY decides).
  - `EmptyState` optically centers within the scrollport (`min-height:100%`/`margin-block:auto` on `.root` or host) — covers the V-11/M-14 centering defect only.
  - Verification: reachability at 1440/900/768/390/320 viewports + 200% zoom; before/after captures for the gutter/surface/mounting deltas (AGENTS UI-evidence rule — this item changes visible spacing and surface shade).
- **Out:**
  - Bottom-nav redesign (item count, label truncation, active-state cue) → item 31 (M-1, F-7, M-4).
  - Settings section subnav → item 32 (V-8, M-7).
  - Selected-state recipes, typography, chips, dividers, panel shadow/border, playlist hand-rolled EmptyState migration, status stripes → item 33 (V-2..V-23 remainders, F-13, F-15, F-23, F-25).
  - Token typos, registry dedup (`TABS`×2), native-atom migration, shell craft (Escape/role/`will-change`/docstring/render-phase `setVisitedTabs`) → item 29 (F-6, F-20, F-21, F-22, F-24).
  - Hit-areas/focus-trap/tablist semantics → item 30 (V-1, M-8/M-9, F-4, F-2, F-8).
  - Mobile chrome (capsule stretch, page bleed, badge overlay, 600–839px hybrid, sheet pills) → item 31.
- **Non-goals:**
  - Not a visual redesign — the only intended visual deltas are the defect repairs themselves (playlist/recap gutters shrink to the shared rhythm, card shades unify, empty states center, last rows clear the nav). Everything else is pixel-parity.
  - Not restructuring the shell chrome (header, sidebar rail, nav order) — the DOM/visual arrangement of nav vs `.body` is item 30/31's territory; this item only adds the scroll inset above it.
  - No new dependencies, no new shared abstractions beyond the one activation signal the contract needs.

## Workflow

The audit did the elicitation: five P0–P2 findings with `file:line` evidence all traced to one root cause — the shell never declared what a tab is. ANALYZE re-verified each ref against source (all confirmed; two minor inaccuracies noted: audit said 4 remap copies, actual is 3 + dictionary paints base surface; F-3 line window is `:217-225` not `:218-224`). Next: SPECIFY derives the exact contract (`.content` padding rule, `.body` remap line, the per-tab scrollport recipe, the recap mount patch, the deactivate-signal mechanism, the bottom-inset token, the `@container` disposition); `ui_surface: yes` → DESIGN approves the spacing/surface deltas against `DESIGN.md` rhythm rules; DELIVER implements the mechanical convergence and verifies via `typecheck + test:unit + build`, real-Chromium passes for reachability/audio-stop/recap-keep-alive, and before/after captures. Person↔system contact: the learner browses tabs; system↔system contact: `visitedTabs` keep-alive + `GET_SESSION_RECAP` revalidation; the deactivate signal is the only new system↔component contract.

## Journey

### AS-IS
1. A learner finishes a study session and opens the Universal Panel on the Playlist tab to find their condensed-audio recordings; the list renders inside `.list`, which has no scroll region, so once the recordings exceed `.content`'s `overflow:hidden` box the tail of the list is clipped — the bottom recordings are unreachable at every viewport and every zoom level, with no scrollbar to betray that content exists (F-1).
2. They press Preview on a visible recording and the `<audio autoPlay>` element starts playing; when they switch to Vocabulary to check a word, the playlist pane is only `display:none`-hidden — the audio keeps playing from an invisible control, and the only ways to silence it are closing the whole panel or navigating back to the tab (F-3).
3. Still hearing the leaked audio, they open Recap; because recap mounts bare via `{activeTab === 'recap' && recapPanel}` instead of the keep-alive `.tabPane` pattern, it refetches the session list and drops their expanded row and scroll position — and every later visit repeats the remount and refetch (F-9).
4. Crossing tabs, the panel feels assembled from different apps: playlist and recap sit on ~28–32px double-gutters over the raw page background while vocabulary, study modes, and settings own 12–16px gutters on an elevated-card surface scheme — five tabs shipped with three mounting patterns, two surface schemes, and a padding carve-out keyed to a `data-cell-id` string that a rename silently orphans (F-5, F-10).
5. On their phone they scroll Settings to the bottom; the "Never synced / Sync now" row lands flush against the bottom-nav hairline with no breathing room, and back in Playlist at 320–390px the rows never wrap onto a second line because the `@container` rule that would have triggered the wrap has no `container-type` ancestor — dead CSS that was never wired (M-3, F-19).
6. Anywhere a tab has no content, the empty state anchors near the top of the body leaving a 60–70% void beneath it — the panel's largest surface reads unfinished precisely when it has the least to show (V-11/M-14).

### TO-BE
1. The learner opens Playlist after the same session; `.list` is now a real scroll region inside the shared `.tabPane`, so every recording scrolls into reach at every viewport and under 200% zoom, and a bottom inset lifts the last row clear of the nav hairline.
2. They press Preview, then switch to Vocabulary mid-playback; the pane's deactivate lifecycle fires and the preview stops and releases — sound follows the visible tab, and closing the panel still tears everything down as before (F-3 repaired, existing close-behavior preserved).
3. They open Recap, expand a session, switch away, and return; recap now rides `visitedTabs`+`.tabPane` like its five siblings, so their expansion and scroll position survive the round-trip while a revalidate-on-activation quietly refreshes the session list if anything changed (F-9 repaired).
4. Crossing all six tabs, one contract is felt: `.content` is a neutral flush shell, each tab owns its own padding, a single surface remap hoisted on `.body` gives every `Card` the same shade — the tabs read as views of one app, and a future seventh tab inherits correct layout by construction rather than by remembering a carve-out list (F-5, F-10 repaired).
5. On the phone, the last row of every scrollport clears the bottom nav by the spacing rhythm; playlist rows wrap as the original CSS intended at narrow widths (or the dead query is honestly gone); and when a tab is empty, the empty state sits optically centered in the scrollport — the promised value lands: nothing unreachable, nothing leaking, nothing feeling bolted-on (M-3, F-19, V-11/M-14 repaired).

## Stories

- S1: As a learner with many recordings or sessions, I want to scroll to every item in Playlist and Recap so that nothing I own is unreachable — done when an overflowing list is fully reachable at all supported viewports and at 200% zoom.
- S2: As a learner previewing audio, I want playback to follow the tab I am actually looking at so that sound never comes from a hidden tab — done when switching away from Playlist stops and clears the preview, while closing the panel still cleans up as before.
- S3: As a learner reviewing a session, I want Recap to remember where I was so that navigating between tabs doesn't cost me my place — done when scroll and expansion survive a tab round-trip and the session list revalidates on activation.
- S4: As a user of the panel, I want all six tabs to feel like views of one app — done when every tab shares the same padding model, scroll behavior, surface scheme, and mounting pattern with no per-tab carve-outs in the shell.
- S5: As a phone user, I want the last row of any list to clear the bottom navigation — done when every tab scrollport carries a bottom inset that clears the nav hairline by the spacing rhythm.
- S6: As a maintainer, I want adding or renaming a tab to never silently break its layout — done when padding is owned per tab, no `data-cell-id`-keyed padding selector exists in the shell, and a new tab mounts correctly through the single `.tabPane`/`visitedTabs` pattern.
- S7: As a maintainer, I want dead responsive code to either work or be gone — done when the playlist `@container` block evaluates against a real container or no longer exists, and narrow-width row behavior is verified at 320–390px.

## Risks

| Risk | Type (human/operational/internal/external/legal/hidden) | Impact | Team's ability to respond |
|---|---|---|---|
| Recap under keep-alive goes stale — a session recorded mid-viewing never appears without remount | internal | User sees stale recap; trust dent, not breakage | mitigated by contract: revalidate `GET_SESSION_RECAP` on activation (F-9, `20261006-…-audit.md:68`); cheap to verify |
| Hoisted surface remap shifts `Card` shade on playlist/recap (they currently paint nothing) | internal | Visual delta inside a "not-a-redesign" item; a grumpy reviewer could call it scope creep | intended outcome per F-10; before/after captures bound the delta; verify card-on-background still reads raised |
| Deactivate-signal mechanism balloons (context, prop threading through kept-alive panes) | internal | Contract complexity for one consumer | smallest mechanism wins in SPECIFY — the audit's own cheapest fix (clear preview state on deactivate, or gate `previewPane` on `activeTab`) is one prop |
| Activating the dead `@container` reveals never-before-rendered wrap layout — the hang-indent `calc(space-3 + 20px)` was never exercised | internal / hidden | Unknown narrow-width layout ships untested | fork recorded: conservative option is activate-and-verify at 320/390px; fallback is delete the block; either way dead code doesn't survive |
| Keep-alive adds a sixth mounted subtree; `<audio>` element suspended but DOM resident | operational | Memory on ≥1GB persona | negligible (one list + one media element); bounded by persona floor |
| Landing order vs items 29/30/31/33 — all touch `UniversalPanel.module.css`, `PlaylistTab.module.css`, `RecapTab.module.css` | operational | Merge noise / re-verify churn | backlog order lands this first (prerequisite-free, gates 31/33); AGENTS ownership rules prevent same-file collisions |
| Bottom inset interacts with dictionary `MobileSheet` which anchors to the same bottom edge | internal | Double-inset or sheet offset | audit flags the missing inset (M-3, `20261006-…-audit.md:58`); `MobileSheet` anchors `bottom:0` in code (`MobileSheet.module.css:10-14`); verify dictionary tab specifically |
| Shadow-root scrollbar styling — raw `overflow-y:auto` inside `mountReactShadow` may show unstyled scrollbars | internal | Cosmetic inconsistency vs `Scrollable`-themed siblings | existing `Scrollable.module.css` pattern (used by `SettingsDialog.module.css:18`) is the template |

## Decision

**go** — a P0 unreachable-content defect (F-1), a P1 audio leak (F-3), and a P1 mount-contract defect (F-5) are not preferences, every mechanism needed already exists in-repo, and the item is prerequisite-free while gating items 31 and 33. The only genuine fork (`@container` activate-vs-remove) is bounded and deferred to SPECIFY with a conservative lean.

## Draft Acceptance Criteria

Need-level ACs (system ACs are derived in SPECIFY → `## Success Criteria`).

- [ ] Playlist `.list` and Recap `.body` scroll when content overflows — reachable at 1440×900, 900×700, 768×1024, 390×844, 320×568 and at 200% zoom; every tab's scrollport verified, not assumed.
- [ ] Switching away from Playlist during a preview stops the audio and clears the preview UI; closing the panel still unmounts and cleans up; the deactivate signal is the single mechanism (no per-tab ad-hoc variants).
- [ ] Recap mounts through `.tabPane` + `visitedTabs` identical to its five siblings; expansion and scroll survive a tab round-trip; `GET_SESSION_RECAP` revalidates on activation.
- [ ] `.content` carries no `data-cell-id`-keyed padding selector; each tab's effective gutter derives from the tab's own padding; effective gutters are uniform across the six tabs at desktop and mobile breakpoints.
- [ ] The `--card-background`/`--color-surface-card` remap exists once on `.body`; the per-tab copies are deleted; a `Card` renders the same shade on all six tabs.
- [ ] Every tab scrollport's last row clears the bottom-nav hairline by ≥ `--space-3` at ≤839px (including safe-area where present); the dictionary `MobileSheet` edge case verified.
- [ ] No dead `@container` remains in `PlaylistTab.module.css` — either rows demonstrably wrap at ≤480px container width, or the block is removed and narrow-width row behavior is verified at 320–390px.
- [ ] `EmptyState` optically centers within the scrollport on all six tabs (top-anchored 60–70% void gone) at 768×1024 and 390×844.
- [ ] Before/after captures show only the intended deltas (scroll reachability, unified gutters/surfaces, centered empty states, bottom inset); `npm run typecheck && npm run test:unit && npm run build` green; real-Chromium pass on tab-switch audio-stop and recap keep-alive.
