---
name: design-svg
description: Design new SVG icons following the Nucleus iconography system (24×24, stroke 1.5, round caps, geometric foundation). Use when the user requests a new icon, wants to redesign an existing icon, or needs custom SVG artwork for the UI. Not for modifying existing SVG code, debugging rendering issues, or creating non-icon illustrations.
---

# Design SVG Icon (Nucleus)

Design new SVG icons that match the project's **Nucleus** iconography system — inspired by Facebook's Nucleus (Fall 2024) and Meta Horizon OS icon guidelines. Produces a compliant `.svg` file, an `ICON_CATALOG` entry, and passing QC checks.

## When to Use

- User requests a new icon for a feature, action, or status
- User asks to redesign or replace an existing icon
- User needs custom SVG artwork that belongs in `ICON_CATALOG`

## When NOT to Use

| Situation | Redirect to |
|-----------|-------------|
| Modifying existing SVG path data | Direct edit + `npm run check-icons` |
| Debugging SVG rendering issues | `debugging-and-error-recovery` |
| Creating logos or illustrations (not UI icons) | Design tool, not a skill |
| Searching for an existing icon | Query `ICON_CATALOG` directly |

## Nucleus Design Principles

Four principles from Facebook's Nucleus system. Every icon must satisfy all four.

| Principle | Meaning | How to verify |
|-----------|---------|---------------|
| **Familiar** | Approachable shapes, clear metaphors dễ nhận diện globally | Would a 5-year-old recognize the object? |
| **Clear** | Strong forms, purposeful visual decisions | Icon reads correctly at 16px? |
| **Confident** | No hesitation in stroke direction, no ambiguous shapes | Every path has a clear start and end? |
| **Simple** | Reduce complexity, focus on what matters most | Max 8 visible elements per icon |

## Nucleus Convention

Reference: `src/shared/icons/index.ts` · QC script: `scripts/check-icons.js`

| Attribute | Value | Why |
|-----------|-------|-----|
| Grid | 24×24px, 2px padding (20×20 live area) | Industry standard, scales cleanly to 48/72/96 |
| Stroke | 1.5px unified | Minimalist, dense UI-friendly |
| Caps/Joins | Round | Friendly, approachable feel (Nucleus: "familiar") |
| Color | `currentColor` | Inherits text color |
| Fill | `none` (outline) | Consistent visual weight |
| ViewBox | `0 0 24 24` | Required by QC script |
| Angles | 45° increments where possible | Meta Horizon OS guideline |
| Transforms | None | Direct coordinates only |
| Disallowed | `<script>`, `<style>`, `<foreignObject>` | Security + rendering consistency |

### Keyline Shapes (geometric foundation)

Nucleus core shapes — shared geometric foundation for visual harmony.

| Shape | Size | Note |
|-------|------|------|
| Circle | 20px diameter | Scale +2% to match square optical weight |
| Square | 18×18px | Smaller than circle due to filled corners |
| Landscape rect | 20×16px | |
| Portrait rect | 16×20px | |

### Optical Corrections

- Circles look smaller than squares → scale up ~2%
- Triangles/arrows shift slightly right/down to appear centered
- Open shapes need heavier visual weight to match closed shapes

## DO / DON'T

From Meta Horizon OS icon guidelines + Nucleus best practices.

| DO | DON'T | Why |
|----|-------|-----|
| Design with simplicity | Complex/intricate details | Hard to distinguish at small sizes |
| Use outline style for mobile/web | Mix filled + outlined in same context | Visual inconsistency |
| Constrain to 20×20 live area | Extend outside 24×24 artboard | Clipping at edges |
| Use 45° angle increments | Arbitrary angles | Breaks geometric harmony |
| Apply 30% opacity for status | Apply opacity to entire icon | Reduces legibility |
| Use `currentColor` | Hardcode colors | Breaks theming |
| Snap to pixel grid | Decimal coordinates | Anti-aliasing blur |
| Max 8 visible elements | Cram too many details | Loses clarity at 16px |

## Workflow

### Step 1: Gather Requirements

**Purpose:** Understand what the icon must communicate before designing.

**Actions:**

Ask the user (one question at a time, per `interview-me` style):

1. What action or concept should this icon communicate?
2. Where will it appear? (popup, subtitle overlay, settings, toolbar)
3. Literal representation or abstract metaphor?
4. Any existing icons to reference? (check `ICON_CATALOG` first)

**Guard:** User has named the concept, the placement, and the metaphor direction.

**Loop back:** If the user cannot answer #1 or #2, ask `interview-me` to extract intent.

### Step 2: Analyze Project Style

**Purpose:** Ground the design in existing patterns so the new icon feels native.

**Actions:**

1. Read `src/shared/icons/index.ts` for the convention
2. Grep `ICON_CATALOG` for similar tags
3. Read 2-3 similar `.svg` files in `src/shared/icons/svg/`
4. Identify the category:

| Category | Pattern | Example icons |
|----------|---------|---------------|
| Nav cluster | Circular background + directional arrow | `nav-prev`, `nav-next`, `nav-repeat` |
| Subtitle overlay | Minimalist, functional | `generate-native`, `side-panel`, `reset-offset` |
| General UI | Nucleus-style outline | `settings`, `search`, `download` |
| Media control | Functional, recognizable | `volume-high`, `maximize`, `pip` |

**Guard:** Can name the category and cite at least one existing icon in that category.

**Loop back:** If no similar icon exists, proceed but note this is a new category.

### Step 3: Find 6 Ideas

**Purpose:** Diverge before converging — avoid designing the first idea that comes to mind.

**Actions:**

1. `web_search` for the concept across multiple libraries:
   - `"lucide [concept] icon"`
   - `"heroicons [concept]"`
   - `"[concept] icon svg"`
2. Collect 6 distinct approaches (different metaphors, not variations of one)
3. For each idea, document:

| # | Source | Visual description | Fits because |
|---|--------|-------------------|--------------|
| 1 | | | |
| 2 | | | |
| ... | | | |

**Guard:** 6 ideas documented with sources, all different metaphors (not 6 tweaks of one shape).

**Loop back:** If fewer than 6 distinct metaphors exist, search `"icon design [concept] inspiration"` or `"[concept] pictogram"`.

### Step 4: Mockup 3 Variants

**Purpose:** Converge to 3 candidates and let the user choose with eyes on the actual shapes.

**Actions:**

1. Select the 3 most promising ideas from Step 3
2. Write each as a compliant SVG mockup:

```svg
<!-- Variant N: [description] -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="..." />
</svg>
```

3. Present all 3 side by side. Use `ask_user_question` with the 3 variants as options.
4. Test each at 16px, 20px, 24px, 32px mentally — flag any that lose detail at 16px.
5. Check against Nucleus principles: Familiar? Clear? Confident? Simple?

**Guard:** User selects one variant or requests a specific combination.

**Loop back:** If user rejects all 3, ask what they dislike and return to Step 3 with refined search.

### Step 5: Implement

**Purpose:** Produce the final icon, register it, and verify compliance.

**Actions:**

1. Create `src/shared/icons/svg/[name].svg` with the approved design
2. Add a descriptive comment at the top of the SVG
3. Add `import` to `src/shared/icons/index.ts`
4. Add entry to `ICON_CATALOG` with semantic tags
5. Run `npm run check-icons` — must pass
6. Run `npm run build` — must pass
7. Commit

**Guard:** `check-icons` passes, build passes, `ICON_CATALOG` has the new entry.

**Loop back:** If `check-icons` fails, fix the SVG attribute that violated the convention. Do not bypass the QC script.

## Anti-Patterns

| Anti-pattern | Why it fails | Do instead |
|--------------|--------------|------------|
| Skip Step 3, design first idea | First idea is usually a cliché | Force 6 ideas before converging |
| Use `stroke-width="2"` | Breaks unified 1.5px system | Always use 1.5px |
| Inline SVG in component | Breaks `ICON_CATALOG` SSOT | Import from catalog |
| Skip `check-icons` | Design drift goes unnoticed | Run QC before commit |
| Use transforms | Rejected by QC script | Use direct coordinates |
| Add fill to outline icons | Visual weight mismatch | Use `fill="none"` unless explicitly filled |
| Complex details at 16px | Loses clarity (violates "Simple") | Max 8 elements, test at 16px |
| Arbitrary angles | Breaks geometric harmony | Use 45° increments |

## Verification

- [ ] User named the concept, placement, and metaphor direction
- [ ] Category identified with at least one reference icon
- [ ] 6 ideas documented with distinct metaphors
- [ ] 3 mockups presented, user selected one
- [ ] Icon satisfies all 4 Nucleus principles (Familiar, Clear, Confident, Simple)
- [ ] DO/DON'T checklist reviewed
- [ ] SVG file created in `src/shared/icons/svg/`
- [ ] `ICON_CATALOG` entry added with semantic tags
- [ ] `npm run check-icons` passes
- [ ] `npm run build` passes
- [ ] Committed with descriptive message

## Router Boomerang

When this skill completes or the task shifts, re-invoke `using-agent-skills` to re-route to the next appropriate skill.
