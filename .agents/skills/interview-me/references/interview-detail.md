# Interview Me — steps 0–6 detail

## Step 0: Load context

Don't ask what's already known.

1. `docs/context/project-context.md` — not found → ask for project context → save file; found → present → confirm or update.
2. `AGENTS.md` (persona, constraints, conventions).
3. `docs/2-architechture-system.md` (structure + dependency graph).
4. `docs/1-share-language.md` (glossary).

Context pre-fills stable frame fields (User, Constraint).

## Step 1: Domain scoping + dependency mapping

1. Grep the idea's keyword in `src/` + `docs/specs/` + `docs/adr/`.
2. Map which features relate, which modules depend.
3. Identify constraints/conflicts the new feature hits; what's missing.
4. Trade-off exists → suggest 2–3 methods, ask user to choose.
5. Update frame: constraint/conflict → Constraint; chosen method → Scope.

Guard: ≥1 grep ran before asking the user anything. Loop back: no relevant domain → proceed anyway, but ground questions in project context.

| DON'T | DO |
|---|---|
| "Anh muốn giải quyết vấn đề gì?" | "Em thấy Cell đã có subtitle-search.md. Idea 'OCR sub' — sub không có file riêng, hay sub có file nhưng không tìm được?" |

→ Load `plugin-research.md` if scoping found specs, knowledge atoms, or no Cell content.

## Step 2: Hypothesize

```text
HYPOTHESIS: You want [X] because [Y].
CONFIDENCE: ~30% — missing: [what's unresolved]
```

The number forces honesty. <70% → append what's unresolved.

## Step 3: One question at a time

```text
Q: <one focused question>
GUESS: <your hypothesis for the answer>
```

One at a time because the user can't react to buried hypotheses, and later questions depend on earlier answers. The attached guess lets the user react to a wrong guess faster than generating from scratch — and commits you to being visibly wrong.

→ `plugin-root-cause.md` when pain/solution is stated vaguely. → `plugin-survey.md` when the user references absent stakeholders ("team tôi", "người X biết").

### Clarification loop (vague answers)

```text
User answers (vague) → AI rephrases specific → "Em hiểu [X]. Đúng chưa?"
  ├─ Confirm → fill frame → next field
  └─ Correct → rephrase → confirm → repeat
```

| User says (vague) | AI rephrases (specific) |
|---|---|
| "Tải sub dễ hơn" | "Tải file phụ đề về máy với ít bước hơn hiện tại" |
| "Máy tôi yếu" | "RAM ≥1GB, Chrome/Edge/Brave, có thể Android" |
| "Tải thủ công" | "(1) mở site → (2) tìm drama → (3) tìm link → (4) tải .srt → (5) merge" |

### Switch to elicitation mode when

User can't answer abstractly; answers vaguely after 2+ rephrases; says "I don't know"/"hard to explain"; idea touches Cell domain needing dependency mapping.

## Step 4: Want vs. should want

Dangerous answers sound thoughtful: best-practice talk ("scalable", "clean architecture"), convention deferral ("the way most apps do it"), "I should probably…".

> *"If you didn't have to justify this to anyone, what would you actually want?"*

## Step 5: Restate — 8-field information frame

```text
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

**"Out of scope" is non-negotiable** — half of misalignment is silent disagreement about what is NOT being built.

### "Enough" per field

| Field | Enough when |
|---|---|
| Problem | 1 concrete pain statement, not abstract |
| User | Specific persona (age, context, device) |
| Current workflow | 3+ steps with pain marker |
| Pain point | 1+ specific pain, quantified |
| Evidence | Review, bug, observation, or data |
| Desired outcome | Measurable |
| Constraint | Specific constraints + domain conflicts |
| Scope | MVP + out-of-scope + chosen method |

## Step 5.5: BACCM check

Load `plugin-baccm-check.md` — verify Change, Need, Solution, Stakeholder, Value, Context each trace to a frame field. Fill gaps before confirming.

## Step 6: Confirm — explicit yes

NOT yes: "whatever you think is best" → re-ask as two concrete options. "Sounds good" → "anything you'd refine?" "Sure, let's go" → often a polite exit. Silence + "okay let's start" → user gave up, not converged — stop and ask if you missed something.

Corrections fold into the frame and restate. Loop until explicit yes.

**95% confidence stop:** you can predict reactions to the next 3 questions AND all 8 fields meet "enough". Several rounds in and still can't predict → "I've asked X questions and still can't predict your reactions. Something foundational is missing. Want to step back?"
