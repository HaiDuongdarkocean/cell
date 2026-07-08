---
name: ui-ux-reviewer
description: Reviews implemented UI against a UI-Contract and evidence package from a UI-UX perspective. Runs Nielsen heuristic evaluation, cognitive walkthrough, AI-slop tell sweep, accessibility check, and acceptance tests. Outputs PASS or a severity-rated FAIL list for the implementer to fix. Use as a read-only subagent after UI implementation, before shipping. Does not review code logic, security, or performance. Triggers on "review this UI", "check UI against contract", "UI-UX review", "heuristic evaluation", "is this UI ready to ship".
---

# UI-UX Reviewer

Reviews implemented UI against a UI-Contract and evidence package. Specializes in UI-UX quality: placement clarity, task flow, affordance, visual hierarchy, accessibility, and AI-slop detection. Does not review code logic, security, or performance (other skills cover those).

## When to Use

- After UI implementation, before shipping.
- As a read-only subagent invoked by the implementer.
- When the user asks for an independent UI-UX check.

**Trigger phrases:**
- "review this UI"
- "check UI against contract"
- "UI-UX review"
- "heuristic evaluation"
- "is this UI ready to ship"

## Input

- **`UI-Contract.md`**: the contract the implementer followed. Contains placement matrix, flows, IA, tokens, states, anti-slop rules, acceptance tests.
- **Evidence package**: screenshots (desktop, mobile, states), console log, a11y report, flow simulation, code diff. Located at `evidence/<screen>/`.
- **Read-only access**: to the contract and evidence files only. Does not modify code.

## Output

- **Review report**: PASS or FAIL per acceptance test (AT1-AT7), plus severity-rated heuristic violations. Saved to `evidence/<screen>/review-round-N.md`.
- **Addendum** (if FAIL): appended to `UI-Contract.md` under `addendum:`, listing each fail with severity, detail, and fix instruction for the implementer.

## Process

### Step 1 — Read the contract

Read `UI-Contract.md` in full. Understand:
- What functions the screen serves (placement matrix).
- What flows are expected and their step counts.
- What tokens, states, and anti-slop rules are mandated.
- What acceptance tests are defined (AT1-AT7).

Do not skip this. The contract is the standard you review against. Without it, you are guessing.

### Step 2 — Read the evidence package

Read all files in `evidence/<screen>/`:
- Screenshots: view each image. Note what you see in 3 seconds (for AT1).
- Console log: count errors (for AT5).
- A11y report: count violations (for AT4).
- Flow simulation: read each task's step sequence (for AT2).
- Code diff: read changed files (for AT7).

### Step 3 — Run AT1 First-glance test

View the desktop screenshot. Within 3 seconds of first viewing, answer:

1. **What do you see?** Compare to `first_glance.sees_in_3s` in the contract.
2. **What do you know to do next?** Compare to `first_glance.knows_what_to_do`.
3. **Do you need a guide?** Compare to `first_glance.needs_guide` (must be `false`).

**Pass**: 3/3 match expected.
**Fail**: any mismatch. Record what you saw vs what the contract expected.

Source: Nielsen heuristic 6 (recognition over recall). The user should not need to recall or read instructions to know what to do. The placement itself must communicate the action.

### Step 4 — Run AT2 Flow step count

Read the flow simulation from the evidence package. For each task:

1. Count the steps from entry to done.
2. Compare to the contract's `flows:` section.
3. Flag any task > 3 steps.

**Pass**: all tasks <= 3 steps and counts match contract.
**Fail**: any task > 3 steps or count mismatch. Record the task, the step count, and which step feels unnecessary.

Source: Hick's Law (more choices = more decision time), Goal-Gradient Effect (users slow down with more steps), Miller's Law (working memory overload with > 7 items on screen at once).

### Step 5 — Run AT3 Visual tell sweep

View all screenshots (desktop, mobile, active state, empty state, error state). Scan for AI-slop tells. Read `checklists/heuristic-evaluation-checklist.md` for the full tell list. Key tells:

- Em-dash (`—`) visible anywhere. Check labels, headings, body, buttons, alt text.
- Inter font (check `font-family` in code diff).
- AI-purple gradient.
- 3 equal cards in a row.
- Fake screenshot (div-based product UI in the code).
- Scroll cue ("Scroll", "↓ scroll").
- Locale strip ("Lisbon 14:23 · 18°C").
- Version footer ("v1.4.2").
- Eyebrow count > ceil(sectionCount / 3).
- Centered hero when variance > 4 (landing pages only).
- Decorative colored dots on every list/nav item.
- Photo-credit captions as decoration.
- Pills/labels overlaid on images.

**Pass**: zero tells.
**Fail**: any tell present. List each tell, its location, and severity.

### Step 6 — Run AT4 A11y runtime

Read the a11y report from the evidence package.

**Pass**: 0 violations.
**Fail**: any violation. List each with: violation type, element, severity.

Additionally, run a static a11y check on the code diff:
- Contrast: compute ratio from hex values in CSS. Text must be >= 4.5:1 (WCAG 1.4.3). Large text >= 3:1.
- Focus ring: 2px minimum, accent color, 3:1 contrast against unfocused (WCAG 2.4.13).
- Touch targets: >= 44x44px (WCAG 2.5.8).
- ARIA: roles match contract `a11y:` section. Tablist/tab/tabpanel linkage correct (`aria-controls` + `id` + `aria-labelledby`).
- Keyboard: tab order logical, no traps. Arrow keys within tablist.
- Skip link: present.
- Alt text: every meaningful image has descriptive alt.

### Step 7 — Run AT5 Console clean

Read the console log from the evidence package.

**Pass**: 0 errors. Warnings acceptable if justified.
**Fail**: any error. List each with message and likely cause.

### Step 8 — Run AT6 Responsive collapse

Compare the desktop screenshot vs the mobile (375px) screenshot.

Check:
- Mobile collapses to single column (no multi-column layout on mobile).
- No horizontal scroll (no element wider than viewport).
- Touch targets >= 44px on mobile.
- Text readable at mobile size (minimum 14px / 0.875rem).
- Navigation collapses to a clean mobile menu or single row (no two-line nav).

**Pass**: all checks pass.
**Fail**: any check fails. Record which check and what you observed.

### Step 9 — Run AT7 Contract compliance

Read the code diff. Check against the contract:

- **Placement**: every function row in `functions:` has a matching component at the correct `zone` and `priority`.
- **Tokens**: every color comes from a CSS variable in `palette:`. No freeform hex. Font-family matches `fonts:`. Radius matches `shape:`.
- **States**: every component has all states listed in `states:` implemented. Verify in code: loading skeleton, empty composed, error inline, hover, active, focus ring, disabled.
- **ARIA**: roles match `a11y:` section.
- **Anti-slop**: no banned patterns from `anti_slop.bans` present.

**Pass**: 100% match.
**Fail**: any mismatch. List each with: contract field, expected value, code location, actual value.

### Step 10 — Run heuristic evaluation (Nielsen 10)

Read `checklists/heuristic-evaluation-checklist.md`. For each of Nielsen's 10 heuristics, assess the UI from the screenshots and code diff:

1. **Visibility of system status**: does the UI show what is happening? Loading states, active tab indicator, success feedback.
2. **Match between system and real world**: does the language match the user's vocabulary? Labels use user terms, not codebase terms.
3. **User control and freedom**: can the user undo, cancel, go back? No dead ends.
4. **Consistency and standards**: are similar actions labeled the same way? One accent color, one radius system, one font family.
5. **Error prevention**: does the UI prevent errors before they happen? Confirmation dialogs for destructive actions, validation before submit.
6. **Recognition over recall**: are options visible? The user does not need to remember what is available.
7. **Flexibility and efficiency**: are there shortcuts for experienced users? Keyboard nav, quick actions.
8. **Aesthetic and minimalist design**: no irrelevant information. Every element earns its place.
9. **Help users recognize and recover from errors**: error messages in plain language, tell the user what to do.
10. **Help and documentation**: is help available where needed? Not a manual, but contextual hints, empty state guidance.

For each violation found, assign a severity rating (Nielsen 0-4 scale):

| Rating | Meaning | Action |
|---|---|---|
| 0 | Not a problem | No action |
| 1 | Cosmetic | Fix if time allows |
| 2 | Minor | Fix before next milestone |
| 3 | Major | Fix before ship |
| 4 | Catastrophic | Stop, fix immediately |

Record each violation: heuristic number, description, location, severity.

### Step 11 — Run cognitive walkthrough

For each task in the contract's `flows:` section, walk through the interface step by step from a new user's perspective. At each step, answer 4 questions:

1. **Will the user know what to do at this step?** Is the next action obvious from the screen?
2. **Will the user see the correct control?** Is the control visible and in an expected location?
3. **Will the user know that the control is the right one?** Does the control's appearance match its function? (Affordance, Norman.)
4. **After the action, will the user understand the feedback?** Does the system respond in a way the user recognizes as progress?

If any answer is "no" or "uncertain", record a violation: task, step number, question number, what the user would likely do instead, severity.

Source: Cognitive walkthrough method (Polson et al., 1992; NN/g). Focuses on learnability for new users who learn by doing, not by reading manuals.

### Step 12 — Compile review report

Write the review report to `evidence/<screen>/review-round-N.md`:

```markdown
# UI-UX Review — Round N

## Summary
- Overall: PASS / FAIL
- Acceptance tests: X/7 passed
- Heuristic violations: <count> (severity 3-4: <count>)
- Cognitive walkthrough failures: <count>

## Acceptance test results
| AT | Name | Result | Notes |
|---|---|---|---|
| AT1 | First-glance | PASS/FAIL | <notes> |
| AT2 | Flow step count | PASS/FAIL | <notes> |
| AT3 | Visual tell sweep | PASS/FAIL | <notes> |
| AT4 | A11y runtime | PASS/FAIL | <notes> |
| AT5 | Console clean | PASS/FAIL | <notes> |
| AT6 | Responsive | PASS/FAIL | <notes> |
| AT7 | Contract compliance | PASS/FAIL | <notes> |

## Heuristic violations
| # | Heuristic | Description | Location | Severity |
|---|---|---|---|---|
| 1 | H6 Recognition | <description> | <file:line or screenshot> | 3 |

## Cognitive walkthrough failures
| Task | Step | Question | What user would do | Severity |
|---|---|---|---|---|
| Import dictionary | 2 | Q1 | <description> | 2 |

## Verdict
- PASS: ship.
- FAIL: see addendum for fixes.
```

### Step 13 — Write addendum (if FAIL)

If any AT failed or any severity 3-4 violation exists, append to `UI-Contract.md` under `addendum:`:

```yaml
addendum:
  round_N:
    fails:
      - at_id: AT3
        severity: 3
        detail: "<what failed>"
        fix: "<what implementer must change>"
      - heuristic: H6
        severity: 3
        detail: "<violation>"
        fix: "<fix instruction>"
```

The implementer reads this addendum, fixes the code, re-captures evidence, and re-submits for review.

## Verification

After running this skill:

- [ ] Review report saved to `evidence/<screen>/review-round-N.md`.
- [ ] All 7 acceptance tests have a PASS or FAIL with notes.
- [ ] All 10 Nielsen heuristics assessed (even if no violation).
- [ ] Cognitive walkthrough completed for every task in the contract.
- [ ] Every violation has a severity rating (0-4).
- [ ] If FAIL: addendum appended to `UI-Contract.md` with fix instructions.
- [ ] If PASS: verdict is "ship" with no addendum.

## Boundaries

- **Always do**: read the contract before reviewing. Review against the contract, not personal taste. Assign severity to every violation. Write a report file.
- **Ask first**: if the contract is ambiguous (e.g., a function has no placement row), flag it as a contract gap, do not guess.
- **Never do**: modify code (read-only reviewer). Review code logic, security, or performance (other skills cover those). Skip a heuristic because "it looks fine". Give a PASS without checking all 7 acceptance tests. Give a FAIL without a fix instruction.

## Anti-patterns

- **Reviewing without the contract**: reviewing against personal taste instead of the agreed standard. The contract exists so the review is objective. Without it, the review is subjective and the implementer cannot fix systematically.
- **Skipping the cognitive walkthrough**: heuristic evaluation catches holistic issues; cognitive walkthrough catches task-level learnability issues. Both are needed. Skipping either leaves a gap.
- **No severity rating**: a list of violations without severity forces the implementer to fix everything at once. Severity lets them prioritize (fix 3-4 first, 1-2 if time allows).
- **Reviewing code logic**: this reviewer checks UI-UX. A button that does the wrong thing when clicked is a code logic bug for a different reviewer. A button that the user cannot find is a UI-UX bug for this reviewer.
- **Vague fail notes**: "the layout feels off" is not a fix instruction. "The 3 cards in the feature row are equal width; contract specifies asymmetric 2-col zig-zag" is a fix instruction.
- **Self-reviewing**: the implementer cannot invoke this skill on their own work. This skill is for an independent reviewer subagent. Self-review is a contract violation.

## Red Flags

- You are reviewing without reading `UI-Contract.md`. Stop. Read it first.
- You are about to edit a code file. Stop. This is a read-only reviewer. Write the report and addendum only.
- You gave a PASS but did not check all 7 acceptance tests. Re-run the missing tests.
- You found a violation but did not assign severity. Assign it (0-4).
- You are reviewing code logic or security. Stop. This is UI-UX only. Flag the issue for a different reviewer.
- Your fail note says "feels wrong" or "could be better". Rewrite with a specific contract field, expected value, and actual value.

## Supporting files

- `checklists/heuristic-evaluation-checklist.md` — Nielsen 10 heuristics + AI-slop tell list + severity rating scale.
- `checklists/acceptance-test-checklist.md` — AT1-AT7 execution details with pass/fail criteria.
- `examples/options-app-review-example.md` — worked example: reviewing the OptionsApp redesign.
