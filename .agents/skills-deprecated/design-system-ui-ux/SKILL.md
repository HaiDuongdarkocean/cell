---
name: design-system-ui-ux
description: "[DEPRECATED] Merged into design-driven-development (Step 9 token definition). Do not invoke. Use design-driven-development instead."
---

> **DEPRECATED** — This skill has been merged into `design-driven-development` (Step 9: design token definition). Do not invoke this skill. Use `design-driven-development` instead. Kept for reference only.

# Design System UI/UX

## One-line summary

Establish a shared visual language (tokens + atoms + enforcement) so every screen looks like one product, then audit drift before it compounds.

## When to Use

- Starting a new project with ≥3 screens planned
- UI feels inconsistent: buttons hover differently, cards have different radius, colors don't match
- About to add the Nth screen and dreading "which style do I copy?"
- Onboarding to an unfamiliar UI codebase — audit before extending
- Before a visual refactor — measure first, refactor second
- Cross-runtime context (popup + sidepanel + content-script, web + mobile, light + dark) where tokens risk drifting

**Trigger phrases:** "design system", "UI inconsistent", "design tokens", "atom component", "audit UI", "thiết kế không nhất quán", "giao diện chắp vá", "refactor UI", "button hover khác nhau", "card radius khác nhau".

## Input

- Path to UI source root (e.g. `src/`, `app/`)
- List of runtime contexts that render UI (popup, sidepanel, content-script, web, mobile — each may have its own stylesheet injection)
- Optional: existing `theme.css` / `tokens.json` / design file (Figma export, brand guide)

## Output

1. **Interface Inventory** — evidence sheet of every UI surface, grouped by component family, with inconsist count + file:line citations
2. **Token Foundation** — flat token file (`tokens.css` or `theme.css`) with semantic names, light/dark if needed
3. **Atom Registry** — list of extracted atoms (only those meeting Rule of Three), each with 1 source file + N call sites
4. **Enforcement Plan** — lint rule / sync test / review checklist that prevents future drift
5. **Drift Audit Report** — pass/fail per axis (radius, color, spacing, hover, focus, typography)

### Output routing rule (CRITICAL — read before writing any artifact)

**Skill directory vs project directory — never confuse them:**

| Artifact type | Location | Why |
|---|---|---|
| **Template** (blank format) | `templates/` in skill dir | Reusable format, generic, no project data |
| **Example** (filled generic sample) | `examples/` in skill dir | Teaches format, NOT tied to a specific project |
| **Project output** (filled with THIS project's evidence) | **Project `docs/`** (e.g. `docs/reviews/`, `docs/design-system/`) | Project artifact → version control → indexed by project `0-wiki.md` |

**Rule:** when this skill runs on a concrete project, every filled artifact (inventory, audit report, token diff) goes into **that project's `docs/`**, never into the skill's `examples/`. The skill's `examples/` folder is for cross-project reusable samples only.

**Anti-pattern that this rule prevents:** agent fills `templates/inventory-template.md` with cell-specific evidence and saves it as `examples/inventory-cell-2026-07-02.md`. Result: project audit buried inside skill directory, not version-controlled with project, not in project `0-wiki.md` index, mixed with generic examples.

**Naming convention for project output:** `<docs-folder>/<audit-name>-YYYY-MM-DD.md` (e.g. `docs/reviews/design-system-inventory-2026-07-02.md`). Date suffix disambiguates re-runs of Step 5 (Drift Audit) over time.

## Process

```
G3 Design phase
├── Step 1 — Interface Inventory (Dan Mall)
├── Step 2 — Token Foundation (flat, no over-nest)
├── Step 3 — Atom Extraction (Rule of Three gate)
├── Step 4 — Enforcement (lint + sync test + review)
└── Step 5 — Drift Audit (re-run Step 1 periodically)

G4 Implementation → delegate component build to `frontend-ui-engineering`
G7 Maintenance → re-run Step 5 each quarter or before major release
```

### Step 1 — Interface Inventory

**Goal:** see the pain before fixing it. Dan Mall: "pain precedes change".

1. List every UI surface: enumerate files via `find_file_by_name` for `*.tsx`, `*.css`, `*.ts` with `style.`/`cssText`/inline styles.
2. Group by component family: buttons, cards, inputs, tags/badges, toggles, dropdowns, dialogs, empty states.
3. For each family, extract: border-radius, hover behavior, focus ring, color (token vs raw), spacing, font-size.
4. Mark inconsist: same family, different value = 1 inconsist. Cite file:line.
5. Classify each inconsist:
   - **Visual** — different radius/color/spacing for same concept → fix with token
   - **Architecture** — different runtime context bypassing tokens → fix with token injection
   - **Interaction** — missing hover/focus/active state → fix with atom
   - **By-design** — intentional difference (e.g. dark overlay on video) → document, do NOT fix
6. Output: project `docs/<audit-name>-YYYY-MM-DD.md` (use `templates/inventory-template.md` as the format — do NOT save filled output into the skill's `examples/`; see Output routing rule above).

**Stop condition:** if 0 inconsist found → skip Steps 2-4, project already consistent. Ponytail.

### Step 2 — Token Foundation

**Goal:** one source of truth for visual decisions. Avoid Token Fatigue (over-nesting).

1. Read existing `theme.css` / `tokens.json` if present — extend, don't reinvent (Dan Mall: "start with what's common, not new").
2. Define **flat** token layers (no alias-of-alias-of-alias):
   - `color`: primary, surface, surface-hover, text, text-muted, border, success, warning, error, + `-subtle` variants only where inconsist measured
   - `spacing`: xs/sm/md/lg/xl on one scale (4px or 8px base — pick one, stick)
   - `radius`: sm/md/lg/full + xs only if inconsist measured
   - `font-size`: xs/sm/base/lg
   - `shadow`: sm/md only
   - `transition`: 150ms ease (one default)
3. **Token Fatigue guard**: do NOT create `color-background-surface-secondary-inverse-hover`. If a token name needs >3 words → it's a component-level style, not a token.
4. Add tokens ONLY for measured inconsist — every new token must cite an inconsist # from Step 1.
5. Light/dark: define `:root` + `[data-theme="dark"]` overrides. Same token names, different values.
6. **Cross-runtime injection**: if project has multiple runtime contexts (popup vs content-script vs sidepanel), each must receive tokens. Options:
   - Shared `tokens.css` imported by all entrypoints (preferred — 1 source)
   - Token mirror file (e.g. `themeTokens.ts`) — only if build pipeline can't share CSS; **must** ship with a sync test (Step 4)
7. Output: `tokens.css` (or extended `theme.css`) + `templates/tokens-template.css`.

### Step 3 — Atom Extraction

**Goal:** one implementation per shared concept. Gate with Rule of Three to avoid over-extraction.

1. For each component family from Step 1, count call sites that **share behavior** (not just look similar — would a single change fix a real inconsist across all of them?).
2. **Rule of Three gate**:
   - 1-2 call sites → duplicate, do NOT extract (premature abstraction risk)
   - 3+ call sites sharing behavior → extract to atom
   - 3+ call sites that look similar but diverge in behavior → do NOT extract; unify tokens only
3. For each extracted atom, create ONE source file:
   - `atoms/Button.tsx`, `atoms/IconButton.tsx`, `atoms/Card.tsx`, `atoms/Input.tsx`, `atoms/Tag.tsx`
   - Atom consumes tokens only (no raw hex, no raw radius)
   - Variants via props (`variant="primary"|"ghost"|"danger"`), not via CSS overrides
4. **Wrong abstraction signals** (extract too early — back out):
   - Atom grows a `mode` prop that changes behavior (not styling)
   - Adding slots to handle one caller's edge case
   - Passing callbacks through 3 layers for one call site
   - Atom file grows faster than features using it
5. Migrate call sites: replace inline/duplicated implementations with atom import.
6. Output: `atoms/` folder + `templates/atom-template.tsx`.

### Step 4 — Enforcement

**Goal:** prevent drift from returning. Three layers, pick minimum that fits project.

1. **Lint rule** (cheapest): ban raw hex/rgba in CSS modules, ban inline `style.cssText` with color values. Use `stylelint` + custom rule, or grep-based pre-commit hook.
2. **Sync test** (for token mirror files): unit test asserting mirror file content matches `tokens.css` section. Catches drift when someone edits one and forgets the other.
3. **Review checklist**: `checklists/drift-audit-checklist.md` — reviewer runs before merge on UI-touching PRs.
4. **Apply minimum**: solo project → review checklist only. Team project → + lint rule. Multi-runtime → + sync test. Do NOT build a documentation site or governance board unless inconsistency cost is demonstrably higher than maintenance cost.
5. Output: `checklists/drift-audit-checklist.md` + optional lint config + optional sync test file.

### Step 5 — Drift Audit (re-run periodically)

**Goal:** measure drift before it becomes pain again.

1. Re-run Step 1 (Interface Inventory) on current codebase.
2. Compare against last inventory — new inconsist? Resolved inconsist?
3. Run `checklists/drift-audit-checklist.md` — pass/fail per axis.
4. Output: project `docs/<audit-name>-YYYY-MM-DD.md` (use `templates/audit-report-template.md` as the format — see Output routing rule).
5. **Cadence**: quarterly, or before major release, or when a new runtime context is added.

## Verification

After running this skill, verify:

- [ ] Interface Inventory exists with ≥1 cited inconsist (or explicit "0 inconsist" statement)
- [ ] Token file exists, flat (no token name >3 words), every token cites an inconsist # or existing usage
- [ ] Atom Registry lists only atoms passing Rule of Three (≥3 behavior-sharing call sites)
- [ ] Enforcement layer matches project scale (solo: checklist; team: +lint; multi-runtime: +sync test)
- [ ] Drift Audit Report pass/fail per axis (radius, color, spacing, hover, focus, typography)
- [ ] No atom has a `mode` prop that changes behavior (wrong abstraction signal)
- [ ] No token name >3 words (Token Fatigue guard)
- [ ] By-design differences documented, not "fixed"

## Boundaries

**Always do:**
- Cite file:line for every inconsist claim — no "it feels inconsistent"
- Gate atom extraction with Rule of Three — count call sites before extracting
- Flat tokens — no alias-of-alias nesting
- Cross-runtime token injection — every context that renders UI must receive tokens
- Document by-design differences — do NOT "fix" intentional choices

**Ask first:**
- Adding a documentation site / Storybook (only if team ≥5 and inconsist cost proven)
- Adding governance model (only if multi-team)
- Extracting atoms for 1-2 call sites (likely premature)

**Never do:**
- Build a full component library for a project with <10 screens (overkill — see "Your Design System Is Probably Overkill")
- Create nested alias tokens (`color-x-y-z-inverse-hover`) — Token Fatigue
- Refactor by-design differences (dark overlay on video, intentional variant) — Norman: affordance fits context
- Extract atom before 3 behavior-sharing call sites exist — premature abstraction
- Skip Step 1 (Inventory) and jump to tokens — you'll fix imagined problems

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Build design system from scratch on day 1 | No pain yet → imagined problems, wrong abstraction | Wait for 3rd screen, then inventory |
| 17 button variants for 8 screens | Over-engineering, documentation outpaces design | Rule of Three: extract only proven-shared atoms |
| `color-background-surface-secondary-inverse-hover` | Token Fatigue — indirection hell, leaky abstraction | Flat: `color-surface-hover` (max 3 words) |
| Full governance + docs site for solo project | Cost > benefit, no one to govern | Review checklist only |
| "Fix" dark overlay on video because it's "inconsistent" | Breaks intentional affordance (Norman) | Document as by-design, exclude from audit |
| Audit by feeling, no file:line | Cannot verify, cannot track resolution | Cite every claim with file:line |
| Token mirror file without sync test | Silent drift — "keep in sync" comment is not enforced | Ship mirror with sync test asserting equality |

## Foundation — 3 sources distilled

| Source | Principle applied here | Where |
|---|---|---|
| **Don Norman** — *The Design of Everyday Things* | Affordance/feedback/conceptual model: every button same hover = same affordance. By-design differences (dark overlay) are affordance fitting context — don't "fix". | Step 1 classification, Boundaries |
| **Brad Frost** — *Atomic Design* (2016) + "Is Atomic Design Dead?" (2023) | Atoms→organisms, but adapt not dogma. Rule of Three gate prevents premature atoms. | Step 3 |
| **Dan Mall** — *Design That Scales* (2023) | Interface Inventory first ("pain precedes change"). "Start with what's common, not new" — extend existing tokens. 80/20: 80% system, 20% intentional custom. | Step 1, Step 2 |

**Over-engineering guards** (from industry critique):
- "Your Design System Is Probably Overkill" (Design Systems Collective) → don't build enterprise infrastructure for <10 screens
- "Token Fatigue: When Abstraction Eats Itself" (Web Designer Depot, 2026) → flat tokens, no alias nesting
- "Rule of Three" (Martin Fowler / Don Roberts) → extract on 3rd behavior-sharing call site, not before

## Relationship to other skills

- **`frontend-ui-engineering`** — builds the actual components. This skill decides WHAT they share (tokens, atoms). Run this skill FIRST in G3, then `frontend-ui-engineering` in G4 to build.
- **`api-and-interface-design`** — designs code-to-code contracts (props, message payloads). This skill designs user-facing visual contracts. Both run in G3; they don't overlap.
- **`code-simplification`** — use after atom extraction if atoms accumulate complexity.
- **`debugging-and-error-recovery`** — use when drift audit reveals a bug (e.g. token referenced but undefined).

## Supporting files

- `templates/inventory-template.md` — Step 1 output **format** (blank — copy this into project docs, do NOT fill in place)
- `templates/tokens-template.css` — Step 2 starter token file
- `templates/atom-template.tsx` — Step 3 atom file structure
- `templates/audit-report-template.md` — Step 5 output **format** (blank — copy this into project docs, do NOT fill in place)
- `checklists/drift-audit-checklist.md` — Step 4 enforcement + Step 5 audit checklist
- `examples/inventory-example.md` — **generic** filled sample (cross-project, teaches format — NOT a substitute for running Step 1 on your actual project)

> Templates + examples in this skill directory are **reusable formats**. Filled artifacts with your project's evidence belong in **your project's `docs/`**, not here. See "Output routing rule" above.
