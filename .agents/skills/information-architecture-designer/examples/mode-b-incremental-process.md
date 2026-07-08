# Mode B — Incremental Addition Process (Steps B1-B6)

> Loaded on demand when Mode B (incremental addition) is triggered.
> Referenced from SKILL.md Step "Mode B — Incremental addition".

When adding 1 function/button to an existing page, the full 12-step process is overkill. The page structure already exists — the IA work is deciding where the new element lands and checking it does not break the existing structure.

## Step B1 — Audit existing page

Read the page the new function will land on. Produce:
- Current wireframe (ASCII, structure only).
- Current groups + zones + order (from the audit, not from guessing).
- Current function count per group (for Miller check in B5).

## Step B2 — Spec the new function

Extract from upstream skill output OR spec/PRD OR user:
- What it does (1-2 sentences).
- Frequency tag (frequent / occasional / rare / destructive).
- Destructive flag (does it delete / reset / irreversibly change state?).
- Trigger type (button, toggle, auto, menu item).

If upstream (`interview-me` / `idea-refine`) already produced this, reuse — do not re-ask.

## Step B3 — Decide placement

Pick the group, zone, and order position for the new function.

| Decision | How to decide |
|---|---|
| **Which group** | Match the new function's domain to an existing group's label. If it fits none, the existing IA model may be wrong — flag to the user (may need Mode A re-design). |
| **Which zone** | Frequency: frequent → primary, occasional → secondary, rare → tertiary. Destructive → always tertiary + separated + confirm. |
| **Order position** | Within the group: frequent first, destructive last, task-flow order if sequential. |
| **Trigger type placement** | Button → inline with group actions. Toggle → inline with settings. Menu item → overflow if rare. |

Cite the principle behind each decision (frequency axis, Jakob's Law, destructive-last).

## Step B4 — Draw placement wireframe

Draw the existing page wireframe with the new element marked `← NEW`. Show before/after if the change is non-obvious.

```
Existing:                    Proposed:
┌───────────┬────────────┐    ┌───────────┬────────────────┐
│▸Tài nguyên│ [Dropzone] │    │▸Tài nguyên│ [Dropzone]     │
│ Giao diện │ Dict A [x] │    │ Giao diện │ Dict A    [x]  │
│ Cài đặt   │ Dict B [x] │    │ Cài đặt   │ Dict B    [x]  │
│           │            │    │           │ [Sync to cloud]│ ← NEW
│           │ [Dropzone] │    │           │ [Dropzone]     │
│           │ Freq  [x]  │    │           │ Freq     [x]   │
└───────────┴────────────┘    └───────────┴────────────────┘
```

If the page is multi-breakpoint, draw the placement on each breakpoint where position differs.

## Step B5 — Side-effect check

Verify the new element does not break the existing structure:

- [ ] **Re-grouping needed?** If the new function does not fit any existing group → flag to user. May require Mode A re-design of the page.
- [ ] **Hick's Law**: visible choices in the affected zone still ≤7?
- [ ] **Miller**: affected group still ≤7 functions after adding? If >7 → chunk into sub-groups or propose subscreen.
- [ ] **Whitespace**: does the new item break existing proximity grouping? Adjust whitespace map if needed.
- [ ] **One primary action per zone**: does the new button compete with an existing primary? If yes, demote one to secondary (text link / icon).
- [ ] **Destructive handling**: if destructive, is it last + separated + confirm-guarded?

## Step B6 — Approval gate

Show the user:
1. Existing page wireframe.
2. New function spec (what / frequency / destructive).
3. Proposed placement wireframe (with `← NEW` marker).
4. Placement decision table (group / zone / order / why).
5. Side-effect check results.
6. Responsive check (if multi-breakpoint).

Ask: "This placement — yes, or refine which part?"

Do NOT proceed to mockup/code until explicit yes. If the user refines, loop B3-B5 with the correction.
