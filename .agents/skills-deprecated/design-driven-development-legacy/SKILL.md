---
name: design-driven-development
description: "[DEPRECATED] Merged into design-driven-development (Step 13 mockup generation). Do not invoke. Use design-driven-development instead."
---

> **DEPRECATED** — This skill has been merged into `design-driven-development` (Step 13: mockup generation). Do not invoke this skill. Use `design-driven-development` instead. Kept for reference only.

# Design-Driven Development

## One-line summary

Generate visual mockup (HTML/SVG) from a confirmed intent + `design-system.md` bounds, agree UI with the user, then hand off the approved mockup to whoever writes the spec, the implementation, and the verification.

## When to Use

- **After a confirmed intent** (`docs/intent/intent-<feature>.md` exists, or the user has otherwise stated what they want)
- **Before the spec** — mockup may change intent requirements
- Feature has ANY UI surface: popup, sidepanel, content-script overlay, settings panel, dropdown, button
- **NOT for**: pure background logic, no-UI features (skip this skill, go straight to spec)

**Trigger phrases:**
- "mockup this UI"
- "design this feature UI"
- "generate mockup"
- "visual mockup"
- "design-driven"

## Input

- **`docs/intent/intent-<feature>.md`** — confirmed intent (user outcome + risk + implementation constraints)
- **`docs/design-system/design-system.md`** — living doc (tokens + components + patterns + a11y + runtime contexts — bounds for mockup)
- **`src/entrypoints/popup/styles/theme.css`** + **`src/shared/lib/themeTokens.ts`** — token values (verify, don't trust doc blindly)
- **`docs/adr/*.md`** — approved interaction patterns
- **`src/`** existing components — mimic patterns, don't invent
- **The user's answers** to Step 0 input-gathering questions (visual reference, user flow, states, input modes, runtime, constraints, a11y, scope)

## Output

| File | When | Folder | Format |
|---|---|---|---|
| `mockup-<feature>.html` | Always (UI feature) | `docs/mockups/mockup-<feature>.html` | HTML single-file, opens in browser, clickable, imports tokens from theme.css |
| `<icon>.svg` | When feature has custom icon | `docs/mockups/icon-svg/<icon>.svg` | SVG separate file |
| `design-contract-<feature>.md` | Optional — only when UI complex (multi-state, multi-token, new interaction) | `docs/mockups/design-contract-<feature>.md` | Markdown: intent contract + bounds + approval + traceability |

## Process

### Step 0 — Gather input from the user (one question at a time, confidence-gated)

> Ask **one question per turn**, attach a guess, track confidence, stop when ≥95%. Do NOT batch — batching kills the agent's ability to react to the user's answers and adjust framing.

**The 8 input domains** (what we need before generating mockup — cover all, skip any already answered in `intent-<feature>.md`):

| # | Domain | Why needed |
|---|---|---|
| 1 | Visual reference | Sets the look-and-feel target (asbplayer / YouTube subtitle settings / Netflix / hand-drawn sketch / no reference) |
| 2 | User flow | Entry point → action → result (free-text) |
| 3 | States | Which states to render (just default / default+loading+error / +empty / +collapsed / multi-state complex) |
| 4 | Input modes | Pointer/keyboard/touch mix (mouse only / mouse+keyboard / mouse+touch / all three) |
| 5 | Runtime | Token source + component convention (popup / sidepanel / content-script overlay / multiple) |
| 6 | Constraints | z-index / position / performance (free-text, or "none") |
| 7 | A11y | Screen reader / keyboard only / touch / color blind (multi-select) |
| 8 | Scope | MVP only / MVP + nice-to-have / future version |

#### Step 0a — Hypothesize first (before any question)

Read `intent-<feature>.md` end-to-end, then write down your best read of the mockup the user wants in **one sentence** + an honest confidence number (0–100%):

```
HYPOTHESIS: The user wants a <runtime> <feature> that looks like <reference>, with <states> states, for <input modes> users.
CONFIDENCE: ~40% — missing: visual reference, states count, a11y floor
```

The number forces honesty. If you can't predict the user's reaction to the next 3 questions, the number is wrong — start lower. When confidence < ~70%, append a one-line reason (what's still unresolved). This tells the user exactly what the interview needs to surface.

#### Step 0b — Ask one question at a time, each with a guess

Use `ask_user_question` tool with **exactly 1 question** per call. Before each call, output a `Q:` + `GUESS:` block as text so the user sees your hypothesis:

```
Q:     <one focused question from the 8 domains above>
GUESS: <your hypothesis for the answer, with reasoning — pulled from intent file, design-system.md, or existing similar features in src/>
```

Then call `ask_user_question` with that single question (options from the domain table; free-text domains use "Other"). The `GUESS` should be reflected in option ordering — put your guessed answer first.

**Rules:**
- **One question per turn.** Never batch 2–4. The third question often depends on the first; batching locks in wrong framing.
- **Always attach a guess.** The user reacts faster to a wrong guess than generating from scratch. It also surfaces *your* assumptions — the whole point.
- **Skip domains already answered** in `intent-<feature>.md` — don't re-ask. Note "skipped — answered in intent" in your running confidence log.
- **Update confidence after each answer.** Re-state the number + what's still missing before the next question.
- **Order by what unblocks the most.** Usually: visual reference → runtime → states → flow → input modes → a11y → constraints → scope. But follow the user's energy — if their answer opens a new unknown, ask that next.

#### Step 0c — Listen for "want vs. should want"

Watch for sophistication-signaling answers ("make it accessible", "modern", "clean", "the standard approach") without specifics. When you hear these, probe:

> *"If you didn't have to justify this to anyone, what would you actually want?"*

One probe often does more work than 3 more questions.

#### Step 0d — The 95% confidence stop

You're done with Step 0 when you can answer **yes** to this:

> *Can I predict the user's reaction to the next 3 questions I would ask?*

If yes → stop, produce the Step 0 restate (below). If no → ask the next question.

**Floor:** if 3+ rounds and confidence isn't rising, that's information, not a reason to grind. Stop and tell the user: *"I've asked X questions and confidence still isn't rising — something foundational is missing. Want to step back?"*

#### Step 0e — Restate mockup brief, confirm before generating

When confidence ≥95%, write back the confirmed mockup brief (tight, the user's language, confirmable line by line):

```
Mockup brief I'll generate:

- Runtime:       <popup / sidepanel / content-script overlay / multiple>
- Visual ref:    <reference or "none — follow design-system.md">
- States:        <list: default + ...>
- Input modes:   <mouse / +keyboard / +touch / all>
- A11y floor:    <screen reader / keyboard / touch / color blind / none>
- Constraints:   <z-index / position / perf / none>
- Scope:         <MVP only / MVP + nice-to-have>
- Out of scope:  <what mockup will NOT show — non-negotiable>

Generate mockup? yes / no / refine?
```

The `Out of scope` line is non-negotiable — half of mockup rework is silent disagreement about what's *not* being drawn. Get an explicit yes before Step 1. "Whatever you think" / "sounds good" / silence are **not** yes — re-ask with two concrete options.

### Step 1 — System sync audit (read, don't grep)

> Read 1 file instead of grep-ing entire codebase. If `design-system.md` is stale → invoke `/design-system-audit` first.

1. Read `docs/design-system/design-system.md` end-to-end
2. Extract bounds for this feature:
   - **Section 1 Tokens**: which tokens to reuse (color/spacing/radius/shadow/transition for this runtime)
   - **Section 2 Components**: existing components to mimic (React vs DOM factory)
   - **Section 3 Patterns**: approved interaction patterns relevant (Pointer Events, keyboard nav, etc.)
   - **Section 4 A11y**: conventions to follow (aria-*, role, touch target, contrast)
   - **Section 5 Runtime**: token source + component convention for target runtime
3. Verify token values vs `theme.css` / `themeTokens.ts` (don't trust doc blindly — sample 3-5 tokens)

### Step 2 — Generate mockup (bounded variance)

> Use `templates/mockup-template.html` as starting point. Replace `<bracketed>` placeholders with feature-specific content.

1. Copy `templates/mockup-template.html` → `docs/mockups/mockup-<feature>.html`
2. Inject tokens from `theme.css` `:root` + `[data-theme="dark"]` (copy-paste, don't invent new tokens)
3. Build component structure matching **runtime context**:
   - **Popup/Sidepanel** → React-style structure (component composition, hooks pattern)
   - **Content-script** → DOM factory-style structure (div nesting, no JSX)
4. Render ALL states from Step 0 (states domain) — default + loading + error + empty + collapsed... — each state as visible section in mockup
5. Apply a11y conventions from Section 4 (aria-*, role, semantic HTML)
6. Add dark mode toggle button (top-right) — mockup must show both light + dark
7. Add page header: feature name + "v1 mockup" + linked ADR + linked intent file
8. If feature has custom icon → create `docs/mockups/icon-svg/<icon>.svg` separately

### Step 3 — User review (visual + edge states + a11y + intent drift)

1. Open `docs/mockups/mockup-<feature>.html` in browser (or instruct the user to open)
2. Ask the user to verify:
   - **Visual**: "Does the UI match your vision?" (compare with reference from Step 0 visual-reference domain)
   - **Edge states**: "Do loading/error/empty/collapsed render correctly?"
   - **A11y**: "Contrast + touch target + ARIA OK?"
   - **Dark mode**: "Dark variant OK?"
3. **Intent drift check**: "Does the mockup change requirements vs intent?"
   - **NO** → approve, go to Step 4
   - **YES** → ask the user to update `intent-<feature>.md` → re-confirm → then Step 4
4. If the user requests changes → revise mockup → re-confirm (loop until approved)
5. On approval: add approval line to mockup HTML header comment:
   ```html
   <!-- Approved by user on YYYY-MM-DD. Mockup revision: vN. -->
   ```

### Step 4 — Optional contract file (only if UI complex)

> Only create if: multi-state (4+) AND multi-token (5+ reused) AND new interaction pattern. Otherwise skip — mockup header approval is enough.

1. Copy `templates/contract-template.md` → `docs/mockups/design-contract-<feature>.md`
2. Fill 5 sections:
   - **Intent contract**: user outcome + risk + platform bounds (from intent file)
   - **Bounded variance**: tokens reused (table) + new tokens (if any) + interaction patterns + a11y floor + edge states
   - **Approval**: user's approval date + drift check result
   - **Traceability**: implementation compliance + verification drift check + accepted deviations
   - **Revision history**: mockup revision log

### Step 5 — Handoff to spec, implementation, verification

1. **Spec**: cite mockup in spec — "§F1 render như mockup panel A (docs/mockups/mockup-<feature>.html)"
2. **Implementation**: code follows mockup structure + tokens; browser verify so sánh real render vs mockup (MCP screenshot)
3. **Verification**: acceptance criteria includes "UI match mockup" + drift check vs contract file (if exists)

## Verification

After running this skill:

- [ ] **Step 0**: HYPOTHESIS + CONFIDENCE stated before first question; questions asked one at a time, each with a GUESS; confidence reached ≥95% (or floor triggered with the user's acknowledgement)
- [ ] **Step 0**: Mockup brief restate produced with `Out of scope` line; the user gave explicit yes before Step 1
- [ ] `docs/mockups/mockup-<feature>.html` exists, opens in browser, renders both light + dark
- [ ] Mockup imports tokens from `theme.css` (no invented tokens — grep verify)
- [ ] All states from Step 0 (states domain) are rendered as visible sections
- [ ] Mockup header has approval line with date + revision
- [ ] `intent-<feature>.md` updated if intent drift detected (or confirmed no drift)
- [ ] Contract file created ONLY if UI complex (multi-state + multi-token + new pattern)
- [ ] Spec cites mockup file path

## Red Flags (Step 0)

- 2+ questions in a single `ask_user_question` call: that's batching, not interviewing
- A question without a `GUESS:` attached: that's surveying, not committing to a hypothesis
- Confidence number with no reason when < ~70%: the user can't help close the gap if they don't know what's missing
- 3+ rounds and confidence isn't rising: you're asking the wrong questions — step back and reframe, don't grind
- Accepting "whatever you think" / "sounds good" / silence as the mockup-brief confirmation
- Skipping the `Out of scope` line in the restate (silent disagreement about non-goals = half of mockup rework)
- Re-asking a domain already answered in `intent-<feature>.md` (wastes the user's energy)

## Boundaries

- **Always do**: Read `design-system.md` before generating. Reuse tokens, don't invent. Render all states. Get the user's approval before handoff. Verify token values vs source files (sample 3-5).
- **Ask first**: If `design-system.md` appears stale (last updated > 1 month ago + recent refactors) → invoke `/design-system-audit` first. If feature needs new token not in `theme.css` → propose to the user, don't invent in mockup.
- **Never do**: Generate mockup before reading `design-system.md`. Invent tokens/components/patterns not in codebase. Skip edge states (empty/loading/error). Skip dark mode. Skip the user's approval. Create contract file for simple UI (YAGNI).

## Anti-patterns

- **Bad**: Batch 4 questions in one `ask_user_question` call → the user skim-reads, gives surface answers, 3rd question was framed wrong because it depended on the 1st.
- **Good**: One question per turn with a `GUESS:` attached → the user reacts to your hypothesis, framing adjusts, confidence rises measurably each round.
- **Bad**: Generate mockup with `--color-accent: #ff6b6b` (invented token) → implementation follows → popup has 2 accent colors → inconsistent.
- **Good**: Reuse `--color-primary` from `design-system.md` Section 1 → implementation uses same token → consistent across popup + content-script.
- **Bad**: Mockup only shows "happy path" (default state) → implementation follows → user hits empty state → UI breaks.
- **Good**: Mockup renders default + loading + error + empty → implementation covers all → edge cases handled.
- **Bad**: Create contract file for 1-button toggle UI → 5-section contract overkill → maintenance burden.
- **Good**: Mockup header approval is enough for simple UI → contract file only for complex (multi-state + multi-token + new pattern).
- **Bad**: Skip the user's approval, hand off mockup to implementation directly → UI doesn't match the user's vision → rework.
- **Good**: Step 3 approval loop → mockup matches vision → implementation proceeds with confidence.

## Frequency

This skill is **invoked per feature** (not periodic). One mockup per UI feature.

| Feature type | Invoke? |
|---|---|
| UI feature (popup/sidepanel/overlay/panel) | ✅ Yes — after intent, before spec |
| Pure background logic (no UI) | ❌ No — go straight to spec |
| Bug fix touching UI | ⚠️ Maybe — if fix changes visual/interaction, mockup the new state |
| Refactor (no visual change) | ❌ No — refactor doesn't need mockup |
