---
name: information-architecture-designer
description: Designs the Information Architecture of a screen before any visual design — groups functions, assigns zones, orders items, maps whitespace, draws ASCII wireframes. Two modes: full screen (re)design, or incremental placement of a new button on an existing page. Applies IA models (scope/domain/task-flow), Gestalt proximity, Hick + Miller, minimalism, and responsive transformation (desktop → tablet → mobile). Reuses upstream from interview-me/idea-refine; feeds design-driven-development. Use when arranging functions into a layout, redesigning a screen's structure, grouping settings, reorganizing a page, designing the IA, deciding where a new button/function should go, or designing responsive layout structure across breakpoints. Do NOT use for visual design (color/font/radius/motion) — use a visual-design skill instead.
---

# Information Architecture Designer

Designs the structure of a screen: which functions group together, which zone each sits in, what order they appear, and where whitespace separates vs unites. Output is a layout proposal + ASCII wireframe, handed off to a visual/UI designer. This skill does NOT touch color, typography, radius, or motion.

## When to Use

This skill has **two modes** — detect which one from the request:

### Mode A — Full screen (re)design
- A function list / spec needs to become a screen layout (placement + grouping + order).
- An existing screen feels cluttered, mis-grouped, or hard to scan.
- A settings / options / dashboard page needs reorganization.
- The user says the structure is wrong but the colors / visuals are fine.

### Mode B — Incremental addition (add 1 function/button to an existing page)
- A new function needs a home on a page that already exists.
- The user says "add a button for X on the Y page".
- Upstream skill (`interview-me` / `idea-refine`) produced a new function concept that needs placement.

**When NOT to use:**
- Visual style / color / typography is the problem (use a visual-design skill instead).
- The function list itself is undefined and no upstream skill ran (run `interview-me` or `idea-refine` first).
- Single-component visual redesign with no structural change (no IA work needed).

## Pipeline — upstream and downstream

This skill sits in a pipeline. Know what feeds in and what it feeds out to.

```
UPSTREAM (provides input)              THIS SKILL              DOWNSTREAM (consumes output)
─────────────────────────             ───────────              ──────────────────────────
interview-me  ─┐                                  ┌─→ design-driven-development
               ├─→ information-                   │   (Phase 1: UI-Contract + mockup)
idea-refine   ─┘   architecture-                  │
                      designer          ┌─────────┼─→ ui-ux-reviewer
                                        │         │   (review vs UI-Contract)
Spec / PRD ─────────────────────────────┘         │
                                                  └─→ G4 Plan / G6 Implementation
```

### What upstream provides (reuse, do not re-ask)

| Upstream skill | Its output | Maps to this skill's input |
|---|---|---|
| `interview-me` | Intent statement (what / why / for whom, ~95% confidence) | **User context** — frequency, mental model, what matters most |
| `idea-refine` | Refined concept (stress-tested, actionable) | **New function spec** (Mode B) — what the function does, edge cases |
| Spec / PRD | Function list + acceptance criteria | **Function list** (Mode A) + **destructive flag** |

**Rule: if an upstream skill already elicited frequency or mental model, do NOT re-ask the user.** Re-asking wastes the user's time and signals you ignored the upstream output. Only ask when upstream output is missing the specific datum you need.

### What this skill feeds downstream

| Downstream skill | What it consumes from this skill |
|---|---|
| `design-driven-development` Phase 1 | Layout proposal (grouping, zones, order, whitespace, wireframe) → drives UI-Contract + mockup |
| `ui-ux-reviewer` | Layout proposal + wireframe → review acceptance tests + cognitive walkthrough |
| G4 Plan / G6 Implementation | Grouping + zones + order → component structure + file layout |

## Input

### Mode A — Full screen (re)design

The skill needs 5 inputs. **4 of 5 are available in the codebase or upstream — fetch them yourself before asking the user anything.** Asking the user what you can read is a failure mode.

| # | Input | Source | Fetch method |
|---|---|---|---|
| 1 | **Function list** | Codebase OR upstream spec | Audit source files (tsx/css), grep handlers, read UI components. OR extract from spec/PRD if upstream ran. |
| 2 | **Constraints** | Codebase + docs | Read `manifest.json` (platform, MV3), `AGENTS.md` (tech stack, boundaries), `docs/adr/` (decisions), architecture doc. |
| 3 | **Existing screen** | Codebase | Path to the current screen file(s) being redesigned. |
| 4 | **Platform + ADR limits** | `manifest.json` + `docs/adr/` | Popup vs full tab, width/height limits, dark/light runtime, what must stay unchanged. |
| 5 | **User context (frequency + mental model)** | Upstream skill OR ask user | If `01_interview-me` ran → reuse its intent output. Else ask ONE focused question. |

### Mode B — Incremental addition

The skill needs 5 inputs, but the set differs from Mode A.

| # | Input | Source | Fetch method |
|---|---|---|---|
| 1 | **Existing page structure** | Codebase | Audit the page the new function lands on. Draw its current wireframe. List current groups + zones + order. |
| 2 | **New function spec** | Upstream skill OR spec/PRD OR user | If `01_idea-refine` ran → reuse its concept output. Else read spec, or ask user "what does this button do?" |
| 3 | **Frequency of new function** | Upstream skill OR ask user | If `01_interview-me` intent states usage → reuse. Else ask "how often will you use this?" |
| 4 | **Relationship to existing functions** | Codebase + user | Audit: which existing group does the new function naturally belong to? Confirm with user if ambiguous. |
| 5 | **Destructive?** | Spec / upstream | Read spec — does the function delete / reset / irreversibly change state? |

### Input-fetch order (mandatory)

**Mode A:**
```
need input
├── 0. Upstream skill ran? → reuse its output (intent → user context, concept → function spec)
├── 1. Codebase audit (function list, constraints, existing screen) ← do this yourself
├── 2. Docs audit (ADR, AGENTS.md, architecture doc) ← do this yourself
├── 3. Cache miss on frequency/mental model (NOT in upstream)? → ask the user ONE focused question
└── 4. Approval gate → ask the user to confirm the proposal (mandatory, not optional)
```

**Mode B:**
```
need input
├── 0. Upstream skill ran? → reuse its output (concept → new function spec, intent → frequency)
├── 1. Audit existing page (codebase) → draw current wireframe, list current groups/zones/order
├── 2. Read new function spec (upstream OR docs/PRD) → what does it do
├── 3. Check destructive (spec) → irreversible?
├── 4. Cache miss on frequency OR grouping? → ask the user ONE focused question each
└── 5. Approval gate → show placement decision, user confirms (mandatory)
```

**Rules (both modes):**
- Do NOT ask the user for the function list — audit the code or read the upstream spec.
- Do NOT ask the user for constraints — read the docs.
- Do NOT re-ask what an upstream skill already elicited — reuse its output.
- Do NOT dump 5 questions at once — ask one focused question only when a cache miss blocks progress.
- DO ask the user at the approval gate — this is mandatory.

### Input examples

**Read `examples/input-examples.md`** for good (Mode A + Mode B) and bad input examples with reasoning.

## Output

### Mode A — Full screen (re)design → layout proposal

A **layout proposal** containing:
1. Function inventory (every function named, with frequency tag: frequent / occasional / rare / destructive).
2. Grouping map (which functions belong together, and why — citing the IA model used).
3. Zone assignment (primary / secondary / tertiary per function).
4. Order within each group (priority top-down or left-right).
5. Whitespace map (where space separates groups, where it tightens).
6. Bad/Good contrast for at least 2 grouping decisions.
7. **ASCII wireframe(s)** showing the structure visually — no color, no font, no radius. Boxes, labels, relative spacing only.
8. **Responsive transformation map** (if multi-breakpoint): for each breakpoint, the nav type, zone visibility, and accordion/billboard decisions. Content parity statement (same groups, different nav).
9. Approval gate answer from the user (yes / refine).

The proposal is the input to a downstream UI-contract / mockup step. This skill does NOT produce HTML mockups or code.

### Mode B — Incremental addition → placement decision

A **placement decision** (smaller than a full proposal — the page structure already exists):

1. **Existing page wireframe** — current structure (audited from codebase).
2. **New function spec** — what it does, frequency tag, destructive flag.
3. **Proposed placement wireframe** — same page with the new button/element marked `← NEW`.
4. **Placement decision table**:

   | Field | Value | Why |
   |---|---|---|
   | Group | [which existing group] | [why it belongs here — cite principle] |
   | Zone | [primary/secondary/tertiary] | [frequency-based] |
   | Order position | [where in group] | [frequency + task-flow] |
   | Destructive handling | [if destructive: separated + confirm] | [safety] |

5. **Side-effect check**:
   - Does adding this trigger re-grouping? (yes/no — if yes, what changes)
   - Hick's Law: visible choices still ≤7 in the affected zone?
   - Miller: affected group still ≤7 functions?
   - Whitespace: does the new item break existing proximity grouping?
6. **Responsive check** (if page is multi-breakpoint): does placement hold on mobile/tablet? Does it need a different position per breakpoint?
7. Approval gate answer from the user (yes / refine).

### Output structure (how to present to the user)

**Mode A** — present in this order so the user can follow the reasoning:

```
1. Function inventory          — table: # | function | frequency | destructive?
2. IA model + grouping map     — model name + groups with labels + why this model
3. Zone + order table          — function | zone | order position | why
4. Whitespace map              — where large gaps / small gaps / borders (with reason)
5. Bad/good contrasts          — 2+ decisions, each: bad | good | principle
6. ASCII wireframe(s)          — desktop variant(s); ask user to pick
7. Responsive transformation  — IF multi-breakpoint:
   ├── Breakpoint table: breakpoint | nav type | zone changes | accordion/billboard
   ├── Content parity statement
   ├── Mobile wireframe (accordion/billboard if structure differs)
   └── Tablet wireframe (if structure differs from both desktop and mobile)
8. Approval gate question      — "yes, or refine which part?"
```

**Mode B** — present in this order:

```
1. Existing page wireframe     — current structure (audited)
2. New function spec           — what | frequency | destructive
3. Proposed placement wireframe — same page with [NEW] marker
4. Placement decision table    — group | zone | order | destructive handling | why
5. Side-effect check           — re-grouping? Hick? Miller? whitespace?
6. Responsive check            — IF multi-breakpoint: placement per breakpoint
7. Approval gate question      — "this placement — yes, or refine?"
```

Items 1-5 (Mode A) or 1-4 (Mode B) are the core. Item 6/7 (responsive) added only when multi-breakpoint. Last item is the gate — do not proceed without explicit yes.

## Process

### Mode detection (do this first)

Read the request and pick the mode:

```
request says...
├── "design/redesign this screen" / "reorganize this page" / "arrange these functions"
│   → Mode A (full screen) — run Steps 1-12
├── "add a button for X on Y page" / "where should this new function go?"
│   → Mode B (incremental) — run Mode B steps below
└── upstream skill (interview-me / idea-refine) produced a new function concept
    → Mode B (incremental) — run Mode B steps below
```

### Mode A — Full screen (re)design (Steps 1-12)

### Step 1 — Inventory functions

List every function the screen must expose. Tag each with:

| Tag | Meaning | Drives placement |
|---|---|---|
| **frequent** | Used most sessions | Upfront, above-fold, primary zone |
| **occasional** | Used sometimes | Visible but below-fold or secondary zone |
| **rare** | Used rarely but important | Progressive disclosure (collapse, "Advanced", subscreen) |
| **destructive** | Irreversible action | Bottom of page, separated, confirm-guarded |

If you cannot tag frequency, ask the user one question: "Which of these do you open most often?" Do not guess.

### Step 2 — Choose the IA model

Pick ONE mental model for grouping. The default for settings/options pages is **scope-first** ("me" / "my team" / "the system"); for dashboards it is **domain** (the work areas); for tools it is **task-flow** (entry → configure → review → act).

```
functions arrive
├── settings/options page? ──→ scope-first (me / team / system)
├── dashboard? ──────────────→ domain (work areas)
└── tool / workflow page? ───→ task-flow (entry → configure → act)
```

A second axis — **change frequency** — always applies on top: frequent controls go upfront, rare-but-important go deep but reachable.

### Step 3 — Group by the model

Assign each function to a group. Rules:

- **3-4 groups** = tabs or top-level sidebar. **5-12** = sidebar with sections. **>12** = sidebar + search + command menu.
- Group labels use the **user's vocabulary**, not codebase module names. "Tài nguyên" not "dictionary-feature".
- No group named "Other" / "Miscellaneous" / "Advanced" as a dumping ground. If a function does not fit a group, the IA model is wrong — re-pick.
- Each group ≤ 5-7 functions (Miller's 4±1 to 7±2 chunks). More → split into a subscreen, or chunk into sub-groups with their own label.

### Step 4 — Order within each group

Order top-down (or left-right for horizontal) by:

1. **Frequency** — frequent first.
2. **Task flow** — if functions form a sequence, follow the sequence (entry → configure → act).
3. **Destructive last** — delete / reset / sign-out at the bottom, visually separated.

### Step 5 — Assign zones

For each function, assign a zone. Zones drive where it sits on the screen.

| Zone | Where | What goes here |
|---|---|---|
| **primary** | Above-fold, top of content | Frequent + task-critical |
| **secondary** | Below-fold, mid content | Occasional, supporting |
| **tertiary** | Bottom, collapsed, or subscreen | Rare, advanced, destructive |

### Step 6 — Whitespace map (proximity over border)

Decide where space groups vs separates. This is the core minimalism move: **whitespace replaces borders**.

- **Large gap** between groups (separates).
- **Small gap** within a group (unites).
- **No border** unless the group needs a hard container (rare — only when proximity alone is ambiguous).
- **One divider** between sub-groups, not between every item.

Read `checklists/layout-audit-checklist.md` and run each item against the proposed layout before showing the user.

### Step 7 — Apply cognitive load limits

For each screen the user will see at once:

- **Visible choices ≤ 7** (Hick's Law). More → progressive disclosure.
- **Chunks ≤ 4-5** per screen (Cowan's updated Miller). Group items so each group is one chunk.
- **Recognition over recall**: show the current value next to the label ("Theme: Dark" not just "Theme").
- **One primary action per zone** — the thing the user most likely came to do.

### Step 8 — Apply visual hierarchy

Pick a scanning pattern and place accordingly:

```
text-heavy page? ──→ F-pattern (important top-left, titles left, content right)
simple / few items? ──→ Z-pattern (top-left → top-right → bottom-left → bottom-right, CTA bottom-right)
```

Hierarchy by **weight + size + whitespace**, NOT by border + shadow. The eye goes to: largest first, highest contrast second, isolated-by-whitespace third.

### Step 9 — Apply minimalism rules

- **Eliminate, don't hide.** If a function is not needed, propose removing it. Hiding still costs cognitive load.
- **Progressive disclosure** for genuinely secondary functions: collapse, "Show advanced", subscreen. Never hide the primary path.
- **One primary action per zone.** Secondary actions are text links or icon buttons, not competing filled buttons.
- **Form follows function.** Every element must serve a task. Decorative borders, shadows, dividers between every row → remove.

### Step 10 — Write bad/good contrasts

For at least 2 grouping decisions in the proposal, write a bad/good pair so the user can see the reasoning. Read `examples/bad-good-examples.md` for the format and concrete cases.

### Step 11 — Draw ASCII wireframe (per breakpoint when structure differs)

A text proposal is not enough — the user cannot visualize structure from tables alone. Draw ASCII wireframe(s) so the user can see the layout before approving.

**Rules:**
- **Structure only** — no color, no font, no radius, no shadow. Those are UI-layer decisions.
- **Boxes** `┌─┐` for containers/panels.
- **Brackets** `[ ]` for buttons, dropzones, inputs.
- **Pipes** `│` for dividers/borders.
- **Whitespace** = relative spacing (more blank lines = bigger gap; do not draw every pixel).
- **Labels** = short group + item names.
- **Active state** = `▸` prefix or bold marker.
- **Collapsed accordion** = `▸ Section name` (closed). **Expanded** = `▾ Section name` with content below.

**How many wireframes to draw:**

```
need wireframe
├── 1 breakpoint only (desktop)? ──→ 1-2 variants (nav type uncertain)
├── multiple breakpoints? ──→ check: does structure differ?
│   ├── same structure, just narrower ──→ 1 wireframe + note "scales down"
│   └── structure differs (nav transforms) ──→ 1 wireframe per breakpoint
└── always: 1 wireframe per distinct structure
```

**Standard breakpoints to consider** (IA cares about structure change, not pixel values):
- **Desktop** ≥1024px: full sidebar, multi-column zones, all groups visible.
- **Tablet** 768-1023px: sidebar shrinks to icon-only OR transforms to top tabs.
- **Mobile** <768px: bottom tab bar (≤5 groups) OR accordion stack OR hamburger drawer (>5 groups).

**Example — desktop sidebar variant:**
```
┌───────────┬───────────────────────────┐
│ Cell      │  Tài nguyên               │
│           │                           │
│▸Tài nguyên│  [Dropzone dictionary]    │
│ Giao diện │  Dict A — 12k mục  [x]    │
│ Cài đặt   │  Dict B — 8k mục   [x]    │
│           │                           │
│           │  [Dropzone frequency]     │
│           │  Freq 50k — 50k    [x]    │
└───────────┴───────────────────────────┘
```

**Example — mobile accordion variant (same 3 groups, structure transformed):**
```
┌───────────────────────────┐
│  Cell — Tùy chọn          │
│                           │
│  [▸ Import dictionary]    │ ← billboard (80% usage)
│                           │
│  ▾ Tài nguyên             │ ← default open (frequent)
│    [Dropzone dictionary]  │
│    Dict A — 12k    [x]    │
│    Dict B — 8k     [x]    │
│    [Dropzone frequency]   │
│    Freq 50k       [x]     │
│                           │
│  ▸ Giao diện              │ ← collapsed (occasional)
│  ▸ Cài đặt                │ ← collapsed (occasional)
│                           │
├───────────────────────────┤
│ [Tài nguyên] [Giao diện] [Cài đặt] │ ← bottom tab (persistent)
└───────────────────────────┘
```

Show the wireframe(s) to the user and ask: "Which variant matches what you picture — A, B, or refine? Does the mobile transformation look right?"

The wireframe is the bridge between the text proposal and the user's mental image. It is cheap to draw (2 minutes) and cheap to change (edit text, not mockup HTML). Do NOT skip this step — a user who approves a text proposal they cannot visualize will request changes later when they see the mockup, costing a full round-trip.

### Step 12 — Approval gate

Show the user:
1. The function inventory + frequency tags.
2. The grouping map with IA model cited.
3. The zone + order table.
4. The whitespace map.
5. The bad/good contrasts.
6. **The ASCII wireframe(s)** — including responsive variants if structure differs per breakpoint.

Ask: "This grouping + order + zones + wireframe(s) — yes, or refine which part?"

Do NOT proceed to mockup/code until explicit yes. If the user refines, loop Steps 3-11 with the correction (re-draw the wireframe if structure changed).

### Mode B — Incremental addition (Steps B1-B6)

When adding 1 function/button to an existing page, the full 12-step process is overkill. The page structure already exists — the IA work is deciding where the new element lands and checking it does not break the existing structure.

**Read `examples/mode-b-incremental-process.md` for the full Steps B1-B6** (audit existing page → spec new function → decide placement → draw wireframe → side-effect check → approval gate).

Summary of Mode B steps:
- **B1**: Audit existing page (wireframe + groups + zones + order + function count)
- **B2**: Spec new function (what / frequency / destructive / trigger type) — reuse upstream if available
- **B3**: Decide placement (group / zone / order / trigger type) — cite principle
- **B4**: Draw placement wireframe (before/after with `← NEW` marker)
- **B5**: Side-effect check (re-grouping? Hick ≤7? Miller ≤7? whitespace? one-primary? destructive handling?)
- **B6**: Approval gate — show placement, ask "yes, or refine?"

## Bad / Good — quick reference

Read `examples/bad-good-examples.md` for full cases. Summary:

| Bad | Good | Why |
|---|---|---|
| Flat list of 12 settings, no groups | 3 groups of 4, sidebar nav | Miller's chunking; Hick's choice reduction |
| Border + shadow on every card | Whitespace between groups, no border | Proximity > Common Region; minimalism |
| "Advanced" / "Other" dumping group | Re-pick IA model so every item fits | Lazy IA; user can't predict what's inside |
| Frequent setting buried at bottom | Frequent upfront, rare at bottom | Change-frequency axis |
| Destructive action next to frequent | Destructive last + separated + confirm | Safety; Jakob's Law convention |
| Every row has a divider | One divider between sub-groups | Divider fatigue; proximity already separates |
| Section title "Other" | Section title "Tài nguyên" (user's word) | Predictability; user vocabulary |
| 8 buttons same visual weight | 1 primary + rest text/icon | One primary action per zone |

## Responsive IA — designing across breakpoints

When the screen must work on desktop, tablet, and mobile, the IA transforms. The grouping stays the same (content parity); the navigation type and zone visibility change.

### Nav pattern transformation (IA decision, not CSS)

| Breakpoint | Screen | Nav pattern | When |
|---|---|---|---|
| Desktop | ≥1024px | Sidebar left (persistent) | 5-12 groups, persistent visibility needed |
| Tablet | 768-1023px | Sidebar icon-only (64px) OR top tabs | Icon sidebar if groups have clear icons; tabs if labels short |
| Mobile | <768px | Bottom tab bar (≤5) OR accordion stack OR hamburger drawer | ≤5 groups → bottom tab; long-form → accordion; >5 → hamburger |

**Rules:**
- **Content parity**: same number of groups on every breakpoint. Never hide a group on mobile — only change how it is shown.
- **Nav type changes, grouping does not**: 3 groups → desktop sidebar / tablet tabs / mobile bottom tab. Still 3 groups.
- **Persistent vs on-demand**: desktop sidebar + mobile bottom tab = persistent (always visible). Hamburger = on-demand (reduces discoverability, use only when >5 groups).
- **Jakob's Law**: sidebar = settings convention (Linear, Vercel, Stripe). Bottom tab = mobile app convention (iOS/Android). Do not invent novel patterns.

### Mobile-first content prioritization (IA decision)

Mobile forces ruthless prioritization. Decide what is essential before desktop adds complexity.

| Function frequency | Desktop | Mobile |
|---|---|---|
| **frequent** | Visible, primary zone | Visible on-top, OR billboard button above nav |
| **occasional** | Visible, secondary zone | Accordion collapse (progressive disclosure) |
| **rare** | Visible, tertiary zone OR subscreen | Accordion collapse, deeper |

**Rules:**
- **Mobile-first progressive enhancement**: design mobile (essential only) first, then add complexity for desktop. Not desktop-down (subtractive).
- **Do not hide functions on mobile** — only collapse. Content parity means every function is reachable, just not always visible.
- **Frequent functions stay visible on mobile**; occasional/rare go into accordion.

### Accordion IA (when to use, how to structure)

| Use accordion when | Do NOT use accordion when |
|---|---|
| Mobile, content long, need to save space | Desktop has enough space (only if content truly long) |
| User needs big picture before details | User needs to compare sections side-by-side |
| Sections are independent | Sections need comparison |
| >5 sections on one page | ≤3 sections (tabs are better) |

**Rules:**
- **One section open at a time** (mobile) — prevents endless scroll.
- **Default open the most frequent section** — recognition over recall.
- **Section title = accordion header** — dual purpose (saves space, acts as mini-IA table of contents).
- **Back button closes accordion** on mobile (browser history integration), does not exit page.
- **Accordion headers = visible table of contents** — user sees big picture before expanding.
- **No nested accordion >2 levels** — expert users only, causes confusion.

### Zone transformation per breakpoint

| Zone | Desktop | Mobile |
|---|---|---|
| **primary** | Above-fold, top of content | On-top (first scroll viewport; no "fold" on mobile) |
| **secondary** | Below-fold, mid content | After primary, may collapse into accordion |
| **tertiary** | Bottom, collapsed, subscreen | Accordion collapse or "Show more" |

### Billboard pattern (mobile, when 1 function dominates)

When one function accounts for ~80% of usage, surface it prominently above the navigation on mobile.

```
Mobile (billboard + accordion):
┌───────────────────────────┐
│  Cell — Tùy chọn          │
│                           │
│  [▸ Import dictionary]    │ ← billboard (80% usage, always visible)
│                           │
│  ▾ Tài nguyên             │ ← accordion (default open)
│  ▸ Giao diện              │ ← accordion (collapsed)
│  ▸ Cài đặt                │ ← accordion (collapsed)
└───────────────────────────┘
```

**Rules:**
- Billboard = 1 prominent action/button above nav, always visible.
- Use only when 1 function clearly dominates usage (≥70-80%).
- Do not billboard more than 1 function — defeats the purpose.

### What is OUT of scope for responsive IA

The IA decides structure transformation. These are UI-layer or implementation concerns — do NOT spec them in the layout proposal:

| Concern | Owner | IA only needs to know |
|---|---|---|
| Thumb zone (bottom 1/3 screen reachable) | UI Designer | IA places primary nav bottom on mobile (structure decision) |
| Touch target 44px minimum | UI Designer / a11y | IA knows this limits visible items count (44px × N ≤ screen height) |
| Breakpoint CSS values (`@media`) | Frontend Dev | IA says "at 768px structure changes" — not the media query |
| Pixel-perfect responsive layout | UI Designer | IA draws structure wireframe, not pixel grid |
| Safe area insets (iOS notch) | UI Designer | IA notes "mobile" — UI handles safe areas |

**Boundary**: "Sidebar becomes bottom tab on mobile" = IA decision. "44px target, 16px gap, `@media (max-width: 767px)`" = UI + CSS.

**Always do:**
- Detect mode first (Mode A full screen vs Mode B incremental) — do not run full 12-step process for a 1-button addition.
- Fetch input from codebase + docs + upstream FIRST. Ask the user only on cache miss.
- Reuse upstream skill output (`01_interview-me` intent, `01_idea-refine` concept) — do not re-ask what upstream already elicited.
- Tag frequency before grouping (Step 1 / Step B2).
- Pick ONE IA model before grouping (Step 2) — Mode A only.
- Cite the principle behind each grouping/placement decision.
- Show bad/good for at least 2 decisions — Mode A. (Mode B: 1 bad/good for the placement decision is enough.)
- Wait for explicit yes at the approval gate.

**Ask first:**
- If a function's frequency is unclear AND no upstream skill elicited it — ask the user one focused question.
- If two IA models seem equally valid — ask which mental model the user thinks in.
- If eliminating a function (Step 9) — confirm with the user; do not silently drop.
- If the screen must work on mobile/tablet — confirm which breakpoints matter to the user before drawing responsive wireframes.
- **Mode B only**: if the new function does not fit any existing group — flag to user; may need Mode A re-design. Do not force-fit into a wrong group.

**Never do (concrete layout bans — checkable, not abstract):**
- Do not produce mockups or code (this skill stops at the layout proposal / placement decision).
- Do not invent a novel navigation pattern (Jakob's Law — use conventions: sidebar, tabs, top nav, bottom tab, accordion).
- Do not group >7 items at one level without chunking or subscreen.
- Do not name a group "Other" / "Miscellaneous" / "Advanced" / "More" / "Additional" — re-pick the IA model instead.
- Do not put a border on every card — border only where proximity alone is ambiguous.
- Do not place a divider between every row — one divider between sub-groups, not between each item.
- Do not render 3+ equal-weight buttons in one zone — one primary, the rest are text links or icon buttons.
- Do not bury a frequent control below a rare one — frequency orders within a group.
- Do not place a destructive action next to a frequent one — destructive last + separated + confirm.
- Do not change colors, typography, or visual style (out of scope — use a visual-design skill).
- Do not hide a group on mobile that exists on desktop — content parity; change nav type, not grouping.
- Do not spec touch target pixels, breakpoint CSS values, or thumb-zone measurements — those are UI-layer.
- Do not nest accordion >2 levels — causes disorientation.
- **Mode B only**: do not force-fit a new function into a group it does not belong to — flag for Mode A re-design instead.
- **Mode B only**: do not skip the side-effect check (B5) — adding 1 button can break Hick/Miller/whitespace of the existing page.

## Verification

The layout proposal (Mode A) or placement decision (Mode B) is done when ALL of these check:

**Both modes:**
- [ ] Mode detected correctly (A full screen vs B incremental).
- [ ] Upstream skill output reused where available (no duplicate questions).
- [ ] Every function from the inventory is assigned to a group + zone + order position (none orphaned).
- [ ] Frequent functions are in the primary zone; destructive are last + separated.
- [ ] At least 1 bad/good contrast written with the principle cited (Mode A: 2+; Mode B: 1+).
- [ ] ASCII wireframe(s) drawn and shown to the user.
- [ ] The user gave an explicit yes at the approval gate (not "sounds good", not silence).
- [ ] `checklists/layout-audit-checklist.md` passes every item.

**Mode A only:**
- [ ] Each group has ≤ 7 functions, or is explicitly chunked into sub-groups.
- [ ] No group is named "Other" / "Miscellaneous" / "Advanced" as a dump.
- [ ] Whitespace map specifies where large gaps separate groups and small gaps unite within.
- [ ] If multi-breakpoint: content parity verified — same groups on every breakpoint, only nav type changes.
- [ ] If mobile accordion: default-open section = most frequent; no nesting >2 levels.

**Mode B only:**
- [ ] Existing page wireframe drawn (before) + placement wireframe drawn (after, with `← NEW` marker).
- [ ] Placement decision table complete (group / zone / order / destructive handling / why).
- [ ] Side-effect check passed: re-grouping? Hick ≤7? Miller ≤7? whitespace? one-primary-per-zone?
- [ ] If multi-breakpoint: placement holds on mobile/tablet, or different position per breakpoint documented.

If any unchecked, the proposal is not complete — return to the relevant step.
