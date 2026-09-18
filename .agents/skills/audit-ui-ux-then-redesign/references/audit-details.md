# Audit Details — taxonomy, step guards, output templates

Reference for `audit-ui-ux-then-redesign`. Read only the section the current step needs.

## Reframe table

| User complaint | Reframe into a design question |
|---|---|
| "It looks ugly" | "Which principle does it violate: color, spacing, typography, shape, or motion?" |
| "It's confusing" | "What is the primary job, and where does the hierarchy fail to support it?" |
| "Too slow" | "Is the bottleneck perceived performance or cognitive load (too many choices)?" |
| "Doesn't fit" | "Which design system rule is broken: token, component, spacing, or shape?" |
| "Too dense" | "What is the right level of disclosure for this user at this step?" |
| "Looks cheap" | "Which detail breaks quiet confidence: color harmony, alignment, radius, or shadow?" |

## The nine aspects — full question ladder

### 1. Strategy & Purpose
*Why does this page exist? Who is it for? What is the one primary job?*
- **L1:** What is the first thing a user sees? What can they do in one tap?
- **L2:** How many jobs compete for primary attention? Are secondary jobs truly secondary?
- **L3:** Does the visual hierarchy match the primary job, the persona, and the device context?
- **Common failures:** multiple primary CTAs fighting; marketing copy obscuring controls; one page serving two personas with opposite needs.

### 2. Information Architecture
*How is content grouped, labeled, sequenced?*
- **L1:** What is grouped together? What is separated?
- **L2:** Does grouping follow the user's mental model and task sequence?
- **L3:** Gestalt proximity, progressive disclosure, clear reading order? Are empty/loading/error states designed, not afterthoughts?
- **Common failures:** fields scattered across unrelated cards; generic "No data" without a next step; key metadata below the fold on mobile.

### 3. Visual System
*Do color, type, spacing, shape, elevation sing the same song?*
- **L1:** Which colors, type sizes, radii, shadows are actually used?
- **L2:** Consistent system or one-off values?
- **L3:** Does the palette follow the identity (quiet confidence, neutral-first, single accent)? Do values map to `tokens.css`?
- **Common failures:** `--md-sys-color-*` or hardcoded hex; 11/13/15px font sizes off-scale; one-off 5px/7px radius; heavy shadows flattening hierarchy.

### 4. Layout & Responsive
*Does the layout adapt without breaking, hiding, overflowing?*
- **L1:** What happens at 320px, 768px, 1280px?
- **L2:** Does reflow keep hierarchy and task order?
- **L3:** Mobile-first? Breakpoints match `STANDARD.md` §9? Does whitespace serve a purpose?
- **Common failures:** two-column layout unusable on mobile; fixed-width cards overflowing; breakpoints tied to device brands instead of content thresholds.

### 5. Components & States
*Are the right shared components used, carrying every needed state?*
- **L1:** What interactive elements exist? What states are visible?
- **L2:** Could a `src/shared/ui/*` component replace a custom element? Does each expose all needed states?
- **L3:** Does every element follow the component contract (default, hover, active, focus, disabled, loading, error)? Touch targets large enough?
- **Common failures:** custom `<button>` without focus/disabled styles; toggle without active state; loading state hiding the label; icon-only button pill-shaped instead of circular.

### 6. Motion & Feedback
*Is motion purposeful, restrained, accessible?*
- **L1:** What animates? What is instant?
- **L2:** Does motion explain a state change or orient the user?
- **L3:** Durations/easings from `tokens.css`? `prefers-reduced-motion` respected? Loading/success/error communicated without relying on color alone?
- **Common failures:** motion for motion's sake; no reduced-motion fallback; error only changes border color; micro-feedback slower than 300ms.

### 7. Accessibility
*Usable by keyboard, screen reader, low vision, motion-sensitive users?*
- **L1:** Is color the only signal? Are labels visible?
- **L2:** Logical focus order? Targets large and well-spaced?
- **L3:** WCAG 2.2 AA (`STANDARD.md` §10.1)? Respects `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more`?
- **Common failures:** placeholder as label; icon-only button without `aria-label`; custom control not keyboard-focusable; contrast below AA.

### 8. Craft & Polish
*Are the invisible details right?*
- **L1:** Anything misaligned, cropped, pixel-hugging?
- **L2:** Do baselines, grids, spacing form a consistent rhythm?
- **L3:** All values from tokens? Icons from `ICON_CATALOG`? Consistent empty/loading/error pattern?
- **Common failures:** 1px misalignment between cards; inline SVG instead of catalog; off-center spinner; type off the baseline.

### 9. SSOT & Maintainability
*If I fix this, how many files should change?*
- **L1:** Where is the value defined? Hardcoded?
- **L2:** Is the pattern duplicated elsewhere?
- **L3:** Is the fix in the right place — token, shared component, or page? Can another agent implement the brief without guessing?
- **Common failures:** same button style in three page CSS files; token changed in one place, hardcoded in another; new component without docs update.

## Question bank (when the audit stalls)

**Reframing:** What is the user trying to do, and what is in their way? If we removed the UI, what is the smallest interface that still works? What would a wrong answer look like? What is the cheapest test that would prove or disprove this?

**First principles:** With no legacy code, what would we build? What is the one rule this screen must never break? Local fix or pattern fix?

**Design tension:** Which two valid principles conflict? Which side do we optimize for and what do we give up? Would the same trade-off make sense on another screen?

**Cross-context:** Where else can this method be used? Is the fix reusable or a one-off? Does it belong in a shared component/token or the page?

## Step guards

**Step 0 Reframe** — Guard: you can answer "what is the real question?" before moving on.
**Step 1 Scope** — identify target (file/route/component/URL); page kind; default mobile-first; produce the Design Read.
**Step 2 Read & Map** — read component + CSS modules + parent layout; inspect DOM/computed styles if a browser is available; ASCII wireframes for 320px and 1280px. Guard: you can answer the five scope questions (primary job, secondary jobs, states, hierarchy at 320px, changes at 1280px).
**Step 3 Classify** — atomic layer per element; reuse/extend/create/remove; flag new tokens/components with rationale.
**Step 4 Audit** — record per finding: Aspect | L1/L2/L3 question | Evidence | Standard | Severity | Current | Proposed | Risk. Stop at 1×P0 or 2×P1.
**Step 5 Decide** — per finding: Question, Current (evidence), Proposed (mapped to token/component), Risk, Verdict. Feasibility check: no new deps, shadow-DOM safe, SSR-safe, reduced-motion, no hardcode.
**Step 6 Brief & Verify** — emit the brief table; run `DESIGN.md` §8 audits; typecheck+build if code changed; append hand-off section when feeding `pipeline-design`.

## Output format

Start with the **Design Read** including the reframed question. Then findings in priority order:

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

## Rationalizations

| User says | Respond with |
|---|---|
| "Just make it look better" | "Better for whom, doing what, on which screen? What principle does it break?" |
| "I don't like it" | "Which aspect feels off: density, color, hierarchy, motion, or layout? I'll reframe it into a question." |
