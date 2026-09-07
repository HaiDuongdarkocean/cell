---
name: inquiry-creativity
description: Turn a vague topic into sharp questions, verified knowledge, and original design decisions using Bloom's taxonomy, critical thinking, and the 4-Step Knowledge Distillation method. Use when the user wants to ask better questions, research a domain, or generate creative solutions from first principles. Not for direct implementation or one-off search queries without synthesis.
---

# Inquiry & Creativity — Bloom + Critical Thinking + 4-Step Knowledge Distillation

> **Asking is a skill. Creating is connecting. Deciding is weighing.**

This skill turns any topic into a chain of precise questions, then pulls verified knowledge from two sources — the **codebase** (SSOT) and the **internet** — and finally connects the dots into an original, well-justified decision.

It follows three frames:
1. **Bloom's Taxonomy** — move up from Remember → Understand → Apply → Analyze → Evaluate → Create.
2. **4-Step Knowledge Distillation** — scope, query, sift, synthesize.
3. **Critical Thinking Loop** — expand options, weigh trade-offs, ask 5 Whys, converge on the most fitting solution.

## When to Use

- The user gives a vague topic and says "tìm hiểu" or "hãy hỏi".
- The user wants to ask better questions before designing or deciding.
- The user wants a creative solution but no raw idea exists.
- The user has a domain keyword and wants verified knowledge distilled into a design input.
- The user must choose between A and B and needs a rigorous, project-aware justification.

## When NOT to Use

- The user gives a concrete, bounded task → just do it.
- The user wants a single fact or quick lookup → use `web_search` directly.
- The user wants code implemented → use `frontend-ui-engineering` or `source-driven-development`.
- The user wants a design brief from a vague UI feeling → use `idea-to-interface`.
- The user wants an audit of existing UI → use `audit-ui-ux-then-redesign`.

---

## Core Principle

> **Creativity is not invention from nothing. It is connecting verified facts in a new pattern. Decision is not picking the best idea; it is picking the idea that best fits the constraints.**

A good answer:
- Names what it knows (Remember).
- Explains what it means (Understand).
- Shows where it applies (Apply).
- Breaks it into parts (Analyze).
- Judges the trade-offs (Evaluate).
- Builds something new (Create).
- Defends why it is the most fitting choice (Critique & Converge).

---

## Source Policy: Two Sources, Two Questions

Every topic must be answered from **both** sources:

1. **Codebase / internal docs** (SSOT):
   - What does this project already know about the topic?
   - Search `docs/`, `src/shared/`, `AGENTS.md`, `DESIGN.md`, `STANDARD.md`.
   - Quote exact context where possible.

2. **Internet / external knowledge**:
   - What do authoritative sources say?
   - Use `web_search`, then `webfetch` for 3–5 sources.
   - Apply SIFT (see Step 3).

If the two sources conflict, **codebase wins for project-specific decisions; internet wins for domain principles**. State the conflict and resolve it.

---

## The 4-Step + Bloom + Critical Thinking Workflow

### Step 1 — Scope the topic with 5W1H

**Purpose:** Sharpen the question before answering it.

**Actions:**
- Ask the user for the **topic/keyword**.
- Run 5W1H on the topic:
  - **What** exactly are we looking for? (concept, comparison, implementation, best practice?)
  - **Why** does it matter for this project/persona?
  - **Where** will the answer be used? (design, code, architecture, copy?)
  - **When** does the user need it? (now vs. later)
  - **Who** is the audience? (engineer, designer, user)
  - **How** should the answer be delivered? (brief, table, questions, design)
- Pick the **Bloom target level** based on the user's need:
  - "là gì" → Remember/Understand
  - "làm thế nào" → Apply/Analyze
  - "có nên không" → Evaluate
  - "hãy tạo ra" → Create

**Guard:** You can state the topic, the Bloom target, and the output form in one sentence.

**Loop back:** If the user cannot answer 5W1H, ask one binary question at a time until the scope is clear.

---

### Step 2 — Design the query with Boolean operators

**Purpose:** Search with precision, not hope.

**Actions:**
- From 5W1H, extract the **main keyword**, **2–3 supporting keywords**, and **1–2 noise words**.
- Build the query with Boolean logic:
  ```
  "keyword chính" AND (bổ trợ 1 OR bổ trợ 2) NOT nhiễu
  ```
- For codebase search, use `grep`/`code_search` with the same Boolean mindset:
  - `pattern: (keyword OR synonym) AND (concept) NOT (noise)`
- For internet search, use `web_search` with the same query.
- Run the queries in parallel where independent.

**Guard:** You can read the query out loud and it is neither too broad (>100k unrelated results) nor too narrow (<3 useful results).

**Loop back:** If the query returns too much noise, add a `NOT` clause. If too few, replace a specific term with a broader synonym.

---

### Step 3 — SIFT the sources

**Purpose:** Trust only verifiable knowledge.

**Actions:**
For each result, ask:
- **S — Stop:** Is the title/domain worth clicking? Avoid clickbait and unauthored pages.
- **I — Investigate:** Who wrote this? (`.edu`, `.gov`, official docs, recognized expert, or anonymous blog?)
- **F — Find a better source:** Can you find the same claim from a more authoritative source?
- **T — Trace to root:** Does the claim cite a paper, spec, or official document? If not, downgrade it.

Codebase sources skip SIFT but still need:
- File path and line number.
- Is the file current or deprecated? (check `git log` or `ROADMAP.md`)
- Is it the project's SSOT or a downstream copy?

**Guard:** You have 3–5 sources ranked by authority. Each has a one-line credibility score: `high` (official/spec/research), `medium` (recognized author), `low` (blog/opinion).

**Loop back:** If no `high` source exists, say so and rely on `medium` sources with caveats.

---

### Step 4 — Synthesize and climb Bloom

**Purpose:** Distill knowledge into an answer at the target level.

**Actions:**
1. **Skim and extract:**
   - Definitions
   - Formulas / rules
   - Real numbers or examples
   - Trade-offs or limitations
2. **Map to Bloom levels:**
   - **Remember:** bullet the key facts.
   - **Understand:** explain in your own words, one paragraph.
   - **Apply:** show one concrete use case for this project.
   - **Analyze:** compare 2+ approaches with a table.
   - **Evaluate:** pick the best approach and defend it with criteria.
   - **Create:** propose a new pattern, component, or workflow based on the verified facts.
3. **Conflict check:** If codebase and internet disagree, surface the conflict and resolve.
4. **Output:** Match the form decided in Step 1.

**Guard:** The final answer:
- Cites at least one codebase source or one high-authority external source.
- Reaches the Bloom target level (or explains why it cannot).
- Contains no unverified claim.

**Loop back:** If the answer cannot reach the target level, ask the user to lower the target or provide more context.

---

### Step 5 — Critique & Converge (Critical Thinking)

**Purpose:** Do not stop at the first workable answer. Find the most fitting one.

> **A senior decision is not "A is better than B"; it is "A is the best fit for these constraints, and here is the risk we accept."**

**Actions:**
1. **Expand options.** List at least 3: A, B, and at least one C/D/E. If the user only gave A/B, use "5 Whys" to generate alternatives.
2. **Define must-haves vs. nice-to-haves.** Must-haves are non-negotiable project constraints (e.g., `build` must pass, `tokens.css` cannot be edited by hand, WCAG AA must hold). Nice-to-haves are desirable but not blocking.
3. **Build a weighted trade-off matrix.**
   - Criteria must map to project constraints: bundle size, build/test pass, responsive, a11y, SSOT, performance, maintenance, time to ship.
   - Each criterion has a weight (sum = 100%).
   - Score each option 1–10 per criterion.
   - Compute `weighted score = score × weight`.
4. **Add confidence and risk for each option.**
   - Confidence: how sure are we that the evidence supports the score?
   - Risk: what could go wrong if we pick this option?
5. **Run the 5 Whys to stress-test the winner.**
   - "Why is this the best fit?"
   - "Why not a hybrid of A and C?"
   - "Why can't we defer this?"
   - "Why will this still work in 6 months?"
   - "Why would a senior engineer disagree?"
6. **Apply the 80% stop rule.**
   - If the top option reaches ≥80% fit and no option is clearly better after 5 Whys, stop iterating and propose a small, reversible experiment.

**Guard:** You can answer:
1. What are the top 3 options?
2. What are the must-have constraints?
3. Which option has the highest weighted score, and what is its main risk?

**Loop back:** If the top two options are within 10% of each other, do another round of 5 Whys or ask the user for their risk tolerance.

---

### Step 5.5 — First-Principles / Unconstrained Best Practice

> **If you remove all project constraints, what is the best solution? Then compare it to the constrained winner. If they tie, the unconstrained one wins because it is closer to first principles.**

**Purpose:** Avoid letting current tooling, deadlines, or local habits define the ceiling of the answer.

**Actions:**
1. **Strip constraints.** Ask: "If we had infinite time, no legacy code, no audit tool limitation, and no migration cost, what would we build?"
2. **Define the ideal solution.** Describe the option that solves the root cause in the cleanest, most reusable, and most theoretically correct way.
3. **Score the ideal solution** with the same weighted matrix, but relax constraints that are purely local (e.g., "axe can't measure pseudo-elements" or "we have 5 files to migrate"). Keep hard constraints like WCAG, physics, or security.
4. **Compare to the constrained winner.**
   - If the ideal solution scores **higher** → choose it and design a migration path.
   - If the ideal solution scores **lower** → the constraints are real; choose the constrained winner.
   - If they are **tied** → choose the ideal/unconstrained solution. It is closer to best practice and will age better.
5. **Document the gap.** If you choose the constrained winner, write one sentence: "We accept X because of Y constraint; the ideal solution is Z."

**Guard:** You can state:
1. What the unconstrained best practice is.
2. Its score vs. the constrained winner.
3. The reason for the gap (or why there is none).

**Loop back:** If you cannot describe the unconstrained solution without mentioning a current tool or file, you are still inside the constraints. Ask again.

---

## Question Bank (Socratic)

Use these to keep asking until the answer reveals itself:

```text
1. What is the one keyword we are really trying to understand?
2. Why does this topic matter to the current project or user?
3. What would a wrong answer look like?
4. What does the codebase already believe about this?
5. What do the best external sources disagree on?
6. If we removed all decoration, what is the core principle?
7. How can we apply this to a real decision we are about to make?
8. What is the cheapest test that would prove or disprove this?
9. What would a senior in this domain question about our conclusion?
10. What new pattern can we build from these verified pieces?
11. Why is option A the best fit, and what risk do we accept?
12. What is a hybrid or third option we haven't considered?
13. If we removed all current constraints, what would the best solution look like?
14. Is the constrained winner tied with the unconstrained best practice? If so, why not choose the best practice?
```

---

## Output Templates

### Template 1 — Knowledge Brief

```markdown
## Inquiry Read
[one line: what we are asking and why]

## 5W1H Scope
- What: ...
- Why: ...
- Where: ...
- When: ...
- Who: ...
- How: ...

## Bloom Target
[level]

## Sources
| Source | Authority | Key claim | Path/URL |
|---|---|---|---|
| codebase: ... | high | ... | `src/...` |
| external: ... | high/medium/low | ... | URL |

## Distilled Knowledge
- **Remember:** ...
- **Understand:** ...
- **Apply:** ...
- **Analyze:** ...
- **Evaluate:** ...
- **Create:** ...

## Verdict
[what to do next]
```

### Template 2 — Question Ladder

```markdown
## Topic
...

## Level 1 — Remember
- What is ...?
- Who created ...?

## Level 2 — Understand
- How would you explain ... in one sentence?

## Level 3 — Apply
- Where in this project would ... be useful?

## Level 4 — Analyze
- What are the parts of ...?
- How does ... compare to ...?

## Level 5 — Evaluate
- Which approach is better for our constraints and why?

## Level 6 — Create
- What new component/pattern/workflow can we invent from these pieces?
```

### Template 3 — Critical Decision Brief

```markdown
## Decision
[one line: what we must choose]

## Must-haves
- [e.g., build pass, no new dep, responsive]
- [e.g., respect tokens.json, use shared UI]

## Options
| Option | Pros | Cons | Trade-off | Weighted score | Confidence | Main risk |
|---|---|---|---|---|---|---|
| A | ... | ... | ... | ... | high/medium/low | ... |
| B | ... | ... | ... | ... | high/medium/low | ... |
| C | ... | ... | ... | ... | high/medium/low | ... |

## 5 Whys stress-test on top option
1. Why is this the best fit? → ...
2. Why not a hybrid? → ...
3. Why can't we defer? → ...
4. Why will this still work in 6 months? → ...
5. Why would a senior disagree? → ...

## First-Principles / Unconstrained Best Practice
- **Ideal solution if no constraints:** ...
- **Why it is best in theory:** ...
- **Re-scored against the same matrix (relaxed local constraints):** ...
- **Comparison to constrained winner:** tied / higher / lower by ...
- **Tie-break rule:** if tied, choose the unconstrained best practice.

## Verdict
[Option X, 80% fit, experiment is ..., and the ideal target is Y]
```

---

## Anti-Patterns

| Do not | Why |
|---|---|
| Answer from memory without searching | Stale or hallucinated knowledge. |
| Use a single source | No cross-check, no confidence. |
| Skip SIFT for internet sources | Trusting unauthored content produces wrong decisions. |
| Confuse Bloom levels | "What is it?" and "What should we build?" need different answers. |
| Skip the codebase | The project already has constraints, tokens, and decisions. |
| Stop at Understand when user needs Create | Every level must be climbed explicitly. |
| Propose a creative solution without verifying feasibility | Creativity without constraints is daydreaming. |
| Pick the first binary option (A or B) | Better options often appear at C, D, or E. |
| Score options without weights | Not all criteria are equally important. |
| Ignore the main risk of the chosen option | A decision without risk is an opinion. |
| Iterate past 80% fit without an experiment | Analysis paralysis. |
| Skip the first-principles option | Current constraints become an invisible ceiling. |
| Choose the constrained winner when tied with the ideal | If they tie, best practice ages better. |

## Common Rationalizations

| User says | Respond with |
|---|---|
| "Tìm hiểu X" | "What level do you need: ghi nhớ, hiểu, vận dụng, phân tích, đánh giá, hay sáng tạo?" |
| "Tại sao lại thế này?" | "Let's check the codebase and 2–3 authoritative sources before answering." |
| "Em nghĩ sao?" | "I'll separate what I know (fact), what I infer (analysis), and what I propose (creation)." |
| "Có cách nào mới không?" | "First we verify what exists; then we combine the pieces into a new pattern." |
| "Chọn A hay B?" | "Let's define must-haves, find a third option, score with weights, and name the risk." |
| "Cứ làm theo ý anh đi" | "Let's verify the constraints first, or we may build something the design system rejects." |
| "A ràng buộc hơn nhưng dễ làm" | "Let's score the unconstrained best practice too. If it ties or wins, we prefer it and design a migration path." |

---

## Verification Checklist

- [ ] 5W1H answered and documented.
- [ ] Bloom target level declared.
- [ ] Query built with Boolean operators.
- [ ] Codebase searched for internal knowledge.
- [ ] 3–5 external sources found and SIFTed.
- [ ] Each source has an authority score.
- [ ] Conflicts between sources are surfaced and resolved.
- [ ] Answer reaches the Bloom target or explains why it cannot.
- [ ] If the task is a decision, at least 3 options are listed with weighted trade-offs.
- [ ] Must-haves and nice-to-haves are separated.
- [ ] 5 Whys stress-test is applied to the top option.
- [ ] Confidence and main risk are stated for the chosen option.
- [ ] 80% stop rule is respected; next step is an experiment, not another round of analysis.
- [ ] First-principles / unconstrained best-practice option is described and scored.
- [ ] Tie-break rule applied: if constrained winner ties with unconstrained best practice, best practice is chosen.
- [ ] Output includes at least one template (Knowledge Brief, Question Ladder, or Critical Decision Brief).
- [ ] Next action or skill is named (e.g., `idea-to-interface`, `audit-ui-ux-then-redesign`, `spec-driven-development`).

---

## Router Boomerang

- Need a UI design brief? → `idea-to-interface`.
- Need to audit existing UI before designing? → `audit-ui-ux-then-redesign`.
- Need to implement the answer? → `frontend-ui-engineering`, `source-driven-development`, or `spec-driven-development`.
- Need to extract requirements from a vague human? → `interview-me` or `elicitation`.
- Need to stress-test the idea before committing? → `doubt-driven-development`.
