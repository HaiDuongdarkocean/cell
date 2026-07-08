# Layout Audit Checklist

> Run against the proposed layout before the approval gate (Step 6 of SKILL.md). Every item must pass.

## Input Fetch (before any grouping)

- [ ] **Mode detected**: Mode A (full screen) vs Mode B (incremental) — picked before fetching.
- [ ] **Upstream output reused**: If `01_interview-me` / `01_idea-refine` ran, their output (intent / concept) is reused — not re-asked.
- [ ] **Function list audited from codebase**: Source files read, every user action listed. Not asked from user. (Mode A)
- [ ] **Existing page audited**: Current wireframe + groups + zones + order drawn from codebase. (Mode B)
- [ ] **New function spec extracted**: From upstream concept OR spec/PRD OR user. (Mode B)
- [ ] **Constraints read from docs**: manifest.json, AGENTS.md, ADRs, architecture doc. Not asked from user.
- [ ] **Existing screen path identified**: Current file(s) being redesigned.
- [ ] **User asked only on cache miss**: Frequency / mental model / grouping question is focused (one question), not a dump.

## Information Architecture

- [ ] **IA model chosen**: One model explicitly picked (scope-first / domain / task-flow). Not "default" or unstated.
- [ ] **Group count fits nav type**: 2-4 groups → tabs; 5-12 → sidebar; >12 → sidebar + search.
- [ ] **No dump group**: No group named "Other", "Miscellaneous", "Advanced", "More", "Additional".
- [ ] **User vocabulary**: Group labels use the user's words, not codebase module names.
- [ ] **Change-frequency axis applied**: Frequent controls upfront, rare-but-important deep but reachable.

## Grouping (Gestalt)

- [ ] **Proximity used first**: Whitespace separates groups before borders do.
- [ ] **Borders minimal**: A border exists only where proximity alone is ambiguous.
- [ ] **Similarity consistent**: Same control type (toggle / select / button) has same visual treatment across groups.
- [ ] **Common region sparingly**: Card/panel containers only when a group needs a hard boundary; not as default decoration.

## Cognitive Load

- [ ] **Visible choices ≤ 7** per screen view (Hick's Law). More → progressive disclosure.
- [ ] **Chunks ≤ 5** per screen (Cowan's 4±1). Each group = one chunk.
- [ ] **Recognition over recall**: Current value shown next to label where applicable.
- [ ] **One primary action per zone**: Not two filled buttons competing.
- [ ] **No orphan function**: Every inventory item is in a group + zone + order slot.

## Order

- [ ] **Frequency order**: Within each group, frequent first (unless task-flow overrides).
- [ ] **Task-flow respected**: If functions form a sequence, order follows the sequence.
- [ ] **Destructive last**: Delete / reset / sign-out at the bottom, visually separated, confirm-guarded.

## Visual Hierarchy

- [ ] **Scanning pattern picked**: F-pattern (text-heavy) or Z-pattern (simple) explicitly chosen.
- [ ] **Hierarchy without chrome**: Weight + size + whitespace drive hierarchy, not border + shadow.
- [ ] **Eye path clear**: Can name where the eye goes 1st, 2nd, 3rd.

## Minimalism

- [ ] **Eliminate before hide**: Every hidden function was confirmed unneeded, not just tucked away.
- [ ] **Progressive disclosure only for secondary**: Primary path never hidden behind a collapse.
- [ ] **No decorative dividers**: One divider between sub-groups, not between every row.
- [ ] **No decorative borders/shadows**: Each remaining border/shadow serves hierarchy or a hard boundary.

## Convention (Jakob's Law)

- [ ] **No invented nav pattern**: Sidebar / tabs / top nav used; no novel custom pattern.
- [ ] **Destructive placement conventional**: Bottom of page or bottom of section, not top.
- [ ] **Settings label conventional**: "Settings" / "Options" / "Preferences" — not a coined term.

## Concrete Layout Bans (checkable)

- [ ] **No border on every card**: A border exists only where proximity alone is ambiguous.
- [ ] **No divider between every row**: One divider between sub-groups, not between each item.
- [ ] **No 3+ equal-weight buttons in one zone**: One primary, rest are text links or icon buttons.
- [ ] **No frequent control buried below rare**: Frequency orders within a group.
- [ ] **No destructive action next to frequent**: Destructive last + separated + confirm.
- [ ] **No dump group name**: No "Other" / "Miscellaneous" / "Advanced" / "More" / "Additional".

## ASCII Wireframe (before approval gate)

- [ ] **Wireframe drawn**: 1-2 variants, structure only (no color/font/radius).
- [ ] **Boxes/brackets/pipes used**: `┌─┐` containers, `[ ]` buttons/inputs, `│` dividers.
- [ ] **Whitespace visible**: Relative gaps shown (more blank lines = bigger gap).
- [ ] **Labels short**: Group + item names, not full sentences.
- [ ] **Shown to user**: User picked a variant or requested refine.

## Responsive Structure (if multi-breakpoint)

- [ ] **Breakpoints identified**: Desktop / tablet / mobile (or whichever the user needs).
- [ ] **Wireframe per distinct structure**: 1 wireframe per breakpoint IF structure differs; 1 + "scales down" note if same structure.
- [ ] **Content parity**: Same number of groups on every breakpoint. No group hidden on mobile.
- [ ] **Nav type transforms appropriately**: Desktop sidebar → tablet tabs/icon-sidebar → mobile bottom-tab/accordion/hamburger. Not invented patterns.
- [ ] **Mobile-first prioritization**: Frequent functions visible on mobile; occasional/rare collapsed into accordion.
- [ ] **Accordion rules (if used)**: Default-open = most frequent section; one open at a time on mobile; no nesting >2 levels; header = section title (dual purpose).
- [ ] **Billboard (if 1 function ≥80% usage)**: Prominent button above nav on mobile; only 1 billboard max.
- [ ] **Zone transformation**: Primary on-top mobile (no "fold"); secondary may collapse; tertiary in accordion or "Show more".
- [ ] **No UI-layer specs in proposal**: Touch target px, breakpoint CSS values, thumb-zone measurements = OUT of scope (UI Designer).

## Approval Gate Readiness

- [ ] **Inventory complete**: Every function tagged frequent / occasional / rare / destructive. (Mode A)
- [ ] **Bad/good contrasts written**: At least 2 (Mode A) or 1 (Mode B), each citing the principle.
- [ ] **ASCII wireframe included**: In the proposal, not skipped. Responsive variants if multi-breakpoint.
- [ ] **Mode B placement wireframe**: Before (existing) + after (with `← NEW` marker) shown.
- [ ] **Mode B side-effect check passed**: Re-grouping? Hick ≤7? Miller ≤7? whitespace? one-primary?
- [ ] **Mode B placement decision table complete**: Group / zone / order / destructive handling / why.
- [ ] **Proposal is showable**: Can be presented as a table + map + wireframe, not just prose.

## Summary

| Section | Pass / Fail |
|---|---|
| Input Fetch | |
| Information Architecture | |
| Grouping (Gestalt) | |
| Cognitive Load | |
| Order | |
| Visual Hierarchy | |
| Minimalism | |
| Convention | |
| Concrete Layout Bans | |
| ASCII Wireframe | |
| Responsive Structure | |
| Approval Gate Readiness | |

**Overall**: APPROVED / NEEDS_FIXES
