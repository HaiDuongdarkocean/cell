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

## The ten aspects — question ladder + common failures

L1 = observable · L2 = structural · L3 = principle.

1. **Strategy & Purpose** — L1: first thing seen, one-tap action · L2: competing primary jobs · L3: hierarchy matches primary job/persona/device. *Failures:* multiple CTAs fighting; two personas with opposite needs.
2. **Interaction Flow** — L1: where eye + focus land on open · L2: reading order (top→bottom, L→R) matches action order; tab order = visual order · L3: per-step cognitive walkthrough — user knows the step, sees the control, understands it, sees progress; entry autofocus on single-task screens; primary action at terminal area; back-navigation keeps entered data. *Failures:* submit above the last input; tab jumps out of visual order; step with no visible next cue; autofocus on a content-heavy screen.
3. **Information Architecture** — L1: what is grouped/separated · L2: grouping matches mental model and task order · L3: progressive disclosure; empty/loading/error states designed. *Failures:* scattered fields; "No data" dead-ends; key metadata below the mobile fold.
4. **Visual System** — L1: which colors/sizes/radii/shadows are used · L2: consistent system or one-offs · L3: values map to `tokens.css`. *Failures:* hardcoded hex; off-scale font sizes; one-off radii; heavy shadows flattening hierarchy.
5. **Layout & Responsive** — L1: 320/768/1280px behavior · L2: reflow keeps hierarchy · L3: mobile-first, content-driven breakpoints. *Failures:* unusable two-column on mobile; fixed-width overflow.
6. **Components & States** — L1: interactive elements and visible states · L2: a `src/shared/ui/*` component could replace custom markup · L3: full state contract (hover/active/focus/disabled/loading/error); touch targets ≥ `--touch-target` (40px). *Failures:* custom `<button>` missing focus/disabled; loading state hiding the label.
7. **Motion & Feedback** — L1: what animates, what is instant · L2: motion explains state change · L3: token durations/easings, `prefers-reduced-motion`, feedback not color-only. *Failures:* motion for its own sake; error shown by border color alone.
8. **Accessibility** — L1: color as the only signal, missing labels · L2: focus order, target size · L3: WCAG 2.2 AA; `prefers-contrast`/`reduced-transparency`. *Failures:* placeholder as label; icon button without `aria-label`; un-focusable custom control.
9. **Craft & Polish** — L1: misaligned/cropped/pixel-hugging · L2: baseline/grid rhythm · L3: all values tokenized, icons from `ICON_CATALOG`. *Failures:* inline SVG instead of catalog; off-center spinner.
10. **SSOT & Maintainability** — L1: where the value is defined · L2: pattern duplicated elsewhere · L3: fix belongs to token/shared component/page — can another agent implement the brief without guessing. *Failures:* same style in three files; fix in the wrong layer.

## Screening checklist — fast pass before the ladder

Ordered by priority: a "no/unsure" higher up makes lower checks meaningless. Any "no/unsure" = a candidate finding; run it through the aspect ladder for evidence.

**P0 — Strategy** (fail here = redo, not patch)

1. What is the single primary job of this screen?
2. Is the primary action the most visually dominant element?
3. Does the eye read in the intended priority order (title → content → action)?
4. What on the screen does not serve the primary job — can it go?

**P0.5 — Interaction Flow** (cognitive walkthrough — sequence, not space)

5. Where do eye + focus land FIRST when the screen opens?
6. Does reading order (top→bottom, L→R) match action order — or must the user jump back up?
7. Single-task screen (login/search/OTP): does the first input take focus on open?
8. Does Tab order follow visual order? Does Enter on the last field submit? Can a keyboard-only user complete the flow?
9. Does the primary action sit at the terminal area (bottom-right desktop, page end mobile) — or somewhere the eye already passed?
10. After EACH step, does the user see progress and know the next step?
11. Does any step force the user to remember info from a previous step/screen?
12. Does going back keep entered data?

**P1 — Structure**

13. One consistent spacing/alignment grid — or a different rhythm per spot?
14. All color/font/radius/spacing from `tokens.css` — zero hardcode?
15. Does a `src/shared/ui/*` component already do this — is a second version being hand-rolled?
16. Does the pattern match how the app solves the same problem elsewhere?

**P2 — Readability**

17. Important text ≥ 4.5:1 contrast?
18. Anywhere color is the ONLY state signal (no icon/label)?
19. Copy short, action-first, jargon-free? (see `audit-text-in-ui` for a full pass)
20. Labels standalone — not placeholder-as-label?

**P3 — States**

21. What does the screen look like empty / loading / error / offline?
22. Every control has hover / focus-visible / active / disabled?
23. Extreme data (empty, 100-char name, huge count) — does layout survive?
24. Do error messages say how to fix, not just "error"?

**P4 — Interaction**

25. Visible response < 100ms on press? Does it look pressable without guessing?
26. Destructive actions have confirm/undo?
27. Does the user know where they are and how to exit — back/close without losing state?

**P5 — Coverage**

28. Hit targets ≥ `--touch-target` (40px) real-box? Screen reader reads it? `prefers-reduced-motion` + 200% zoom survive?
29. Smallest supported viewport usable, no horizontal scroll?

**P6 — Polish**

30. Animation purposeful and ≤ token duration, non-blocking? Translated text (+30% length) doesn't break? No layout shift?

## Step guards

- **0 Reframe** — you can answer "what is the real question?"
- **1 Scope** — target identified; mobile-first; one-sentence Design Read produced.
- **2 Read & Map** — component + CSS modules + parent layout read; DOM/computed styles inspected if browser available. Guard: can answer the five scope questions (primary job, secondary jobs, states, hierarchy at 320px, changes at 1280px).
- **3 Classify** — per element: reuse `src/shared/ui/*` / extend / create / remove; new tokens/components flagged with rationale.
- **4 Audit** — per finding: Aspect | L1/L2/L3 question | Evidence | Standard | Severity | Current | Proposed | Risk. Stop at 1×P0 or 2×P1.
- **5 Decide** — per finding mapped to token/component; feasibility check: no new deps, shadow-DOM safe, reduced-motion respected, no hardcode.
- **6 Brief & Verify** — emit brief table; audits theo `clean-design/knowledge/ops/audit.md`; typecheck+build if code changed; hand-off section when feeding `pipeline-design`.

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
- [e.g., touch target ≥ 40px (`--touch-target`)]

**Starting frame for `pipeline-design`:**
- Component/pattern scope: ...
- Primary job: ...
- Suggested 3 dials: DESIGN_VARIANCE [?], MOTION_INTENSITY [?], VISUAL_DENSITY [?]
- Suggested starting point in `src/shared/ui/*`: ...
```
