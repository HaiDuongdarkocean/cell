# Audit Details — taxonomy, step guards, output templates

Reference for `audit-ui-ux-then-redesign`. Read only the section the current step needs.

## Reframe table

| User complaint | Reframe into a design question |
|---|---|
| "It looks ugly" | "Which principle does it violate: color, spacing, typography, shape, or motion?" |
| "It's confusing" | "What is the primary job, and where does the hierarchy fail to support it?" |
| "Too slow" | "Perceived performance or cognitive load (too many choices)?" |
| "Doesn't fit" | "Which design system rule is broken: token, component, spacing, or shape?" |
| "Too dense" | "What is the right level of disclosure for this user at this step?" |
| "Looks cheap" | "Which detail breaks quiet confidence: color harmony, alignment, radius, or shadow?" |

## The nine aspects — question ladder + common failures

L1 = observable · L2 = structural · L3 = principle.

1. **Strategy & Purpose** — L1: first thing seen, one-tap action · L2: competing primary jobs · L3: hierarchy matches primary job/persona/device. *Failures:* multiple CTAs fighting; two personas with opposite needs.
2. **Information Architecture** — L1: what is grouped/separated · L2: grouping matches mental model and task order · L3: progressive disclosure; empty/loading/error states designed. *Failures:* scattered fields; "No data" dead-ends; key metadata below the mobile fold.
3. **Visual System** — L1: which colors/sizes/radii/shadows are used · L2: consistent system or one-offs · L3: values map to `tokens.css`. *Failures:* hardcoded hex; off-scale font sizes; one-off radii; heavy shadows flattening hierarchy.
4. **Layout & Responsive** — L1: 320/768/1280px behavior · L2: reflow keeps hierarchy · L3: mobile-first, content-driven breakpoints. *Failures:* unusable two-column on mobile; fixed-width overflow.
5. **Components & States** — L1: interactive elements and visible states · L2: a `src/shared/ui/*` component could replace custom markup · L3: full state contract (hover/active/focus/disabled/loading/error); touch targets sized. *Failures:* custom `<button>` missing focus/disabled; loading state hiding the label.
6. **Motion & Feedback** — L1: what animates, what is instant · L2: motion explains state change · L3: token durations/easings, `prefers-reduced-motion`, feedback not color-only. *Failures:* motion for its own sake; error shown by border color alone.
7. **Accessibility** — L1: color as the only signal, missing labels · L2: focus order, target size · L3: WCAG 2.2 AA; `prefers-contrast`/`reduced-transparency`. *Failures:* placeholder as label; icon button without `aria-label`; un-focusable custom control.
8. **Craft & Polish** — L1: misaligned/cropped/pixel-hugging · L2: baseline/grid rhythm · L3: all values tokenized, icons from `ICON_CATALOG`. *Failures:* inline SVG instead of catalog; off-center spinner.
9. **SSOT & Maintainability** — L1: where the value is defined · L2: pattern duplicated elsewhere · L3: fix belongs to token/shared component/page — can another agent implement the brief without guessing. *Failures:* same style in three files; fix in the wrong layer.

## Step guards

- **0 Reframe** — you can answer "what is the real question?"
- **1 Scope** — target identified; mobile-first; one-sentence Design Read produced.
- **2 Read & Map** — component + CSS modules + parent layout read; DOM/computed styles inspected if browser available. Guard: can answer the five scope questions (primary job, secondary jobs, states, hierarchy at 320px, changes at 1280px).
- **3 Classify** — per element: reuse `src/shared/ui/*` / extend / create / remove; new tokens/components flagged with rationale.
- **4 Audit** — per finding: Aspect | L1/L2/L3 question | Evidence | Standard | Severity | Current | Proposed | Risk. Stop at 1×P0 or 2×P1.
- **5 Decide** — per finding mapped to token/component; feasibility check: no new deps, shadow-DOM safe, reduced-motion respected, no hardcode.
- **6 Brief & Verify** — emit brief table; `DESIGN.md` §8 audits; typecheck+build if code changed; hand-off section when feeding `pipeline-design`.

## Output format

**Design Read** first (including the reframed question), then findings in priority order:

```markdown
### [P0/P1/P2] [Aspect] — [Short title]

**Question:** ... (the L3 question that exposed the issue)
**Current:** ... (evidence: file line, computed style, token, or screenshot)
**Design tension:** ... (if any)
**Standard:** ... (citation with reasoning)
**Proposed:** ...
**Risk:** ...
**Verdict:** change / keep / reject
```

End with a **Redesign Brief** table and a **SSOT action list**.

## Hand-off to pipeline-design

```markdown
## Hand-off to pipeline-design

**Design Read:** [one line]
**Reframed question:** [one line]

**Top constraints (P0/P1):**
1. [Finding] → [what the new design must solve]

**Non-negotiables:**
- [e.g., must use existing `Button` not custom `<button>`]
- [e.g., touch target ≥ 44px on mobile]

**Starting frame for `pipeline-design`:**
- Component/pattern scope: ...
- Primary job: ...
- Suggested 3 dials: DESIGN_VARIANCE [?], MOTION_INTENSITY [?], VISUAL_DENSITY [?]
- Suggested starting point in `src/shared/ui/*`: ...
```
