---
name: interview-me
description: Extract what users actually want before any plan, spec, or code exists — interview mode for users who can articulate and elicitation mode with prototype validation for users who cannot; use when an ask is underspecified, the user can't articulate needs, or you catch yourself silently filling in ambiguous requirements; not for unambiguous asks, pure information requests, or when a spec already exists.
---

# Interview Me

## Overview

**What people ask for and what they actually want are different things.** They ask for "a dashboard" because that's conventional, not because it solves their problem. They say "make it faster" without a number.

The cheapest moment to find this gap is before any plan, spec, or code exists. Once you've started building, switching costs are real, and the user will rationalize the wrong thing into "good enough."

**Two modes, one skill:**

- **Interview mode** — user CAN answer abstract questions. One question at a time, with your best guess attached, until 95% confidence.
- **Elicitation mode** — user CANNOT answer abstract questions. Context + domain scoping + clarification loop + prototype with real Cell components.

Auto-select: start interview mode, switch to elicitation mode when the user can't answer or when the idea touches existing Cell domain.

## When to Use

- Ask missing who/why/success/constraint
- Request is conventional, not specific ("build me X", "make it faster")
- You're tempted to start with assumptions you haven't surfaced
- User can't articulate needs — "I have an idea but don't know how to explain it"
- Idea touches existing Cell domain — need to check specs, dependencies, conflicts
- Need prototype validation before committing to spec
- User invokes: "interview me", "grill me", "elicitation", "stress-test my thinking"

## When NOT to Use

- Ask is unambiguous and self-contained ("rename this variable")
- User explicitly asked for speed over verification
- Pure information requests ("how does X work?")
- Idea refinement when intent is already clear → `idea-refine`
- Spec already exists → `spec-review-stakeholder`
- You already have ≥95% confidence

## Loading Constraints

**Needs a live, responsive user.** Don't invoke in CI pipelines, scheduled runs, `/loop`, or autonomous-loop. Flag as blocker instead of guessing.

## Plugins

**Load plugins when triggered. Don't run them by default.**

| Plugin | Trigger | File |
|---|---|---|
| Root Cause Analysis | User states pain/solution vaguely | `plugin-root-cause.md` |
| Research Elicitation | Domain scoping finds specs/atoms/competitors | `plugin-research.md` |
| Survey Questionnaire | User references absent stakeholders | `plugin-survey.md` |
| BACCM Check | After 8-field restate, before confirm | `plugin-baccm-check.md` |

Each plugin is self-contained. Update one without touching the others.

## Step 0: Load Context

**Don't ask what's already known.**

1. Read `docs/context/project-context.md`
   - Not found → ask for project context → save file
   - Found → present to user → confirm or update
2. Read `AGENTS.md` (persona, constraints, conventions)
3. Read `docs/2-architechture-system.md` (structure + dependency graph)
4. Read `docs/1-share-language.md` (glossary)

Context pre-fills stable fields (User, Constraint) in the information frame.

## Step 1: Domain Scoping + Dependency Mapping

**Don't ask generic questions. Map the domain first.**

1. Grep keyword from user's idea in `src/` + `docs/specs/` + `docs/adr/`
2. Map domain knowledge: which features relate? which modules depend?
3. Identify constraint/conflict: new feature affects which existing? what's missing?
4. Suggest 2-3 methods when trade-off exists → ask user to choose
5. Update frame: constraint/conflict → Constraint field; chosen method → Scope field

**→ Load `plugin-research.md` if domain scoping found specs, knowledge atoms, or no Cell content.**

**Guard:** At least 1 grep ran before asking the user any question.

**Loop back:** If no relevant domain found, proceed to Step 2 — but still ground questions in project context from Step 0.

**Codebase-aware vs generic:**

| DON'T | DO |
|---|---|
| "Anh muốn giải quyết vấn đề gì?" | "Em thấy Cell đã có subtitle-search.md. Idea 'OCR sub' — sub không có file riêng, hay sub có file nhưng không tìm được?" |

## Step 2: Hypothesize

**Write your best read + honest confidence number before asking.**

```
HYPOTHESIS: You want [X] because [Y].
CONFIDENCE: ~30% — missing: [what's unresolved]
```

If confidence <70%, append what's still unresolved. The number forces honesty.

## Step 3: Ask One Question at a Time

**One question, one guess, wait for reaction.**

```
Q: <one focused question>
GUESS: <your hypothesis for the answer>
```

**Why one at a time:** user can't react to hypotheses buried in a list. Third question often depends on first answer.

**Why attach guess:** user reacts faster to a wrong guess than generating from scratch. It commits you to a hypothesis you can be visibly wrong about.

**→ Load `plugin-root-cause.md` if user states pain/solution vaguely.**

**→ Load `plugin-survey.md` if user references other stakeholders ("team tôi", "người X biết").**

### Clarification loop (elicitation mode — vague answers)

**Don't accept vague answers. Rephrase → confirm.**

```
User answers (vague)
    ↓
AI rephrases → specific, concrete
    ↓
AI asks: "Em hiểu [X]. Đúng chưa?"
    ├─ Confirm → fill frame → next field
    └─ Correct → rephrase again → confirm → repeat
```

| User says (vague) | AI rephrases (specific) |
|---|---|
| "Tải sub dễ hơn" | "Tải file phụ đề về máy với ít bước hơn hiện tại" |
| "Máy tôi yếu" | "RAM ≥1GB, Chrome/Edge/Brave, có thể Android" |
| "Tải thủ công" | "(1) mở site → (2) tìm drama → (3) tìm link → (4) tải .srt → (5) merge" |

### Switch to elicitation mode when:

- User can't answer abstract questions
- User answers vaguely after 2+ rephrase attempts
- User says "I don't know" or "hard to explain"
- Idea touches Cell domain needing dependency mapping

## Step 4: Listen for "Want vs. Should Want"

**Dangerous answers sound thoughtful but aren't what they actually want.**

Watch for: best-practice talk ("scalable", "clean architecture"), convention deferral ("the way most apps do it"), "I should probably…".

When you hear these, ask:

> *"If you didn't have to justify this to anyone, what would you actually want?"*

## Step 5: Restate — 8-Field Information Frame

**When confidence is high, write back what you think the user wants.**

```
- Problem:           <concrete pain statement>
- User:              <persona, pre-filled from context>
- Current workflow:  <how they do it today, with pain marker>
- Pain point:        <specific, quantified>
- Evidence:          <strongest evidence someone needs this>
- Desired outcome:   <measurable>
- Constraint:        <binding limit + domain conflicts>
- Scope:             <MVP + out-of-scope + chosen method>

Yes / no / refine?
```

**"Out of scope" is non-negotiable.** Half of misalignment is silent disagreement about what is NOT being built.

### "Enough" criteria per field

| Field | Enough when |
|---|---|
| Problem | 1 concrete pain statement, not abstract |
| User | Specific persona (age, context, device) |
| Current workflow | 3+ steps with pain marker |
| Pain point | 1+ specific pain, quantified |
| Evidence | Evidence (review, bug, observation, data) |
| Desired outcome | Measurable outcome |
| Constraint | Specific constraints + domain conflicts |
| Scope | MVP + out-of-scope + chosen method |

## Step 5.5: BACCM Check

**→ Load `plugin-baccm-check.md` — verify all 6 BACCM concepts (Change, Need, Solution, Stakeholder, Value, Context) have a field tracing to them.**

Fill any gap before confirming. BACCM is not optional — every elicitation has all 6 concepts, explicit or not. Making them explicit prevents blind spots.

## Step 6: Confirm — Explicit Yes

**The gate is an explicit "yes."** These are NOT yes:

- "Whatever you think is best." → Re-ask with two concrete options as a choice.
- "Sounds good." → Ask: "Anything you'd refine?" Silence isn't confirmation.
- "Sure, let's go." → Often polite exit. Same follow-up.
- Silence + "okay let's start." → User gave up, not converged. Stop and ask if you missed something.

If they correct you, fold the correction in and restate. Loop until explicit yes.

### 95% Confidence Stop

**Done when you can predict the user's reaction to the next 3 questions.**

AND all 8 fields meet "enough" criteria.

If you've gone several rounds and still can't predict: "I've asked X questions and still can't predict your reactions. Something foundational is missing. Want to step back?"

## Phase 2 — Prototype (elicitation mode only)

**Skip in interview-only mode.** Validate with prototype when user can't articulate.

### Step 7: Design Concepts & Mockup (idea-to-interface)

**Before writing code, explore alternatives and let the user pick a direction.**

**Actions:**
- Invoke `/idea-to-interface` with the confirmed 8-field frame as the raw idea or confirmed intent.
- Run the full pipeline: Socratic anchoring → 3 unconstrained concepts → interactive mockup site (Real panel + Concept A/B/C + Mobile/Desktop + Light/Dark) → user choice.
- Get: `docs/intent/[topic]-design-brief.md` with 3 concept cards, and `src/entrypoints/mockup-[topic]/` with the live mockup.
- Once the user picks a concept, get `docs/intent/[topic]-component-mapping.md` (reuse / extend / redesign / create).
- The chosen concept's brief + component mapping become the SSOT for the prototype's visual, interaction, and component decisions.

**Loop back:** If none of the 3 concepts match the 8-field frame, return to `/idea-to-interface` Step 1 to re-anchor, or reconcile with the user before building the prototype.

### Step 8: Generate Prototype Page

**Real Cell components, not throwaway HTML.**

1. Use `docs/intent/[topic]-component-mapping.md` from Step 7 to decide reuse / extend / redesign / create for every UI element.
2. Create showcase page: import from `@/shared/ui/`, use tokens from `tokens.css`
3. Logic: state model (React hooks) — flow from frame: detect → list → pick → action → result
4. UI: real components, responsive (desktop + tablet + Android)
5. Build: `npx vite build --mode development`
6. Open via `browser_preview` or showcase URL (see `redesign-in-showcase`)

**Logic + UI in parallel.** Not sequential — evolve together.

### Step 9: User Drive Prototype

Open `browser_preview`. User presses buttons, tries flow. AI observes state changes + UI reaction.

### Step 10: Feedback → Rephrase → Confirm → Log

```
AI: "Anh thấy prototype này thế nào?"
    ↓
User feedback (possibly vague)
    ↓
AI rephrases → "Em hiểu góp ý là [X]. Đúng chưa?"
    ├─ Confirm → LOG feedback → proceed
    └─ Correct → rephrase → confirm → LOG → repeat
```

**Every confirmed feedback MUST be logged immediately.** Don't rely on memory — append to intent doc after each confirm.

**Log format** — append to `docs/intent/[topic].md` under `## Prototype feedback log`:

```markdown
## Prototype feedback log

### Round N — [date]
- [feedback #1]: [rephrased confirmed statement]
- [feedback #2]: [rephrased confirmed statement]
- Frame updates: [fields changed]
- Prototype updates: [what changed in code]
```

**Guard:** After each feedback round, log is appended before proceeding to Step 10. If log not updated, stop and update.

### Step 11: Analyze Feedback

| Type | Action |
|---|---|
| Logic gap | Fix logic in prototype |
| UI gap | Fix UI in prototype |
| Missing feature | Update frame (Step 5) + log |
| Constraint conflict | Update frame + domain map (Step 1) + log |

**AI judgment — feedback correct or not:**

- Correct → accept → update frame + prototype → log
- Incorrect → explain why + suggest alternative → confirm → log

### Step 12: Update Frame + Intent Doc

If feedback correct: add/edit frame fields AND update `docs/intent/[topic].md`. Frame is SSOT — prototype reflects frame — intent doc reflects frame.

### Step 13: Sync Component

**If feedback changes a component, update the real component.**

| Feedback | Sync action |
|---|---|
| New variant | Add variant to `src/shared/ui/` |
| New component | Add to `src/shared/ui/` + catalog |
| Token change | Edit `tokens.json` (NOT `tokens.css`/`tokens.ts`) → `npm run build` |
| New icon | Read `ICON_CATALOG` first → reuse or create + add to catalog |

**Always run `npm run build` after sync.** Always update `docs/2-architechture-system.md` if `src/` changed.

### Step 14: Confirm → Loop or Exit

```
AI: "Em đã cập nhật [X]. Anh cần góp ý thêm, hay confirm chuyển sang phase tiếp theo?"
    ├─ More feedback → return to Step 8 (prototype v2) or Step 7 if the design brief needs to change
    └─ Confirm → Phase 2 DONE
```

## Output

**Confirmed 8-field frame + explicit yes = the deliverable.** In elicitation mode, also includes prototype validation results.

Save to `docs/intent/[topic].md` if user wants persistence. Only save after confirm.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The ask is clear enough" | If you can't write desired outcome in one sentence, run Step 2. |
| "Asking wastes their time" | Building the wrong thing wastes more. |
| "They said 'whatever you think'" | Delegation, not decision. Re-ask with two concrete options. |
| "User can't answer, so I'll guess" | Switch to elicitation mode. Don't guess when you can elicit. |
| "Prototype is throwaway" | Fake HTML = invalid feedback. Use real Cell components. |

## Red Flags

- 3+ questions in one message (batching, not interviewing)
- Question without hypothesis attached (surveying, not committing)
- Accepting "whatever you think" as terminal
- Generic questions when codebase has relevant specs
- Accepting vague answer without rephrase → confirm
- Prototype with fake HTML
- Sync component without `npm run build`
- Saving intent doc before user confirms
- Plugin loaded without trigger condition met
- Feedback confirmed but not logged to intent doc (will be forgotten)
- Intent doc not updated after frame changes (doc diverges from frame)

## Verification

- [ ] Context loaded from `docs/context/project-context.md` (or created)
- [ ] Domain scoping ran — grep + dependency map + constraints
- [ ] Hypothesis + confidence stated in first turn
- [ ] Questions one at a time, each with guess attached
- [ ] Codebase-aware questions (not generic)
- [ ] Clarification loop ran for vague answers
- [ ] "Want vs. should want" probe ran when user gave sophistication-signaling answer
- [ ] 8-field restate written back to user
- [ ] User confirmed with explicit yes
- [ ] Agent could predict reactions to next 3 questions at stop point
- [ ] (Elicitation mode) Prototype with real Cell components, user drove, feedback looped
- [ ] (Elicitation mode) Every feedback round logged to `docs/intent/[topic].md` before proceeding
- [ ] (Elicitation mode) Intent doc updated with frame changes after each round
- [ ] (Elicitation mode) Component sync ran `npm run build`
- [ ] Plugins loaded when triggered (root-cause, research, survey)
- [ ] Handoff to downstream skill framed in confirmed intent

---

## Router boomerang

Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route.
