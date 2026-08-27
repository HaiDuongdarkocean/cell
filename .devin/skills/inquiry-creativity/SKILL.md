---
name: inquiry-creativity
description: Turn a vague topic into sharp questions, verified knowledge, and original design decisions using Bloom's taxonomy and the 4-Step Knowledge Distillation method. Use when the user wants to ask better questions, research a domain, or generate creative solutions from first principles. Not for direct implementation or one-off search queries without synthesis.
---

# Inquiry & Creativity — Bloom + 4-Step Knowledge Distillation

> **Asking is a skill. Creating is connecting.**

This skill turns any topic into a chain of precise questions, then pulls verified knowledge from two sources — the **codebase** (SSOT) and the **internet** — and finally connects the dots into an original, well-justified answer.

It follows two frames:
1. **Bloom's Taxonomy** — move up from Remember → Understand → Apply → Analyze → Evaluate → Create.
2. **4-Step Knowledge Distillation** — scope, query, sift, synthesize.

## When to Use

- The user gives a vague topic and says "tìm hiểu" or "hãy hỏi".
- The user wants to ask better questions before designing or deciding.
- The user wants a creative solution but no raw idea exists.
- The user has a domain keyword and wants verified knowledge distilled into a design input.

## When NOT to Use

- The user gives a concrete, bounded task → just do it.
- The user wants a single fact or quick lookup → use `web_search` directly.
- The user wants code implemented → use `frontend-ui-engineering` or `source-driven-development`.
- The user wants a design brief from a vague UI feeling → use `design-from-idea`.
- The user wants an audit of existing UI → use `audit-ui-ux-then-redesign`.

---

## Core Principle

> **Creativity is not invention from nothing. It is connecting verified facts in a new pattern.**

A good answer:
- Names what it knows (Remember).
- Explains what it means (Understand).
- Shows where it applies (Apply).
- Breaks it into parts (Analyze).
- Judges the trade-offs (Evaluate).
- Builds something new (Create).

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

## The 4-Step + Bloom Workflow

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

---

## Anti-Patterns

| Don't | Why |
|---|---|
| Answer from memory without searching | Stale or hallucinated knowledge. |
| Use a single source | No cross-check, no confidence. |
| Skip SIFT for internet sources | Trusting unauthored content produces wrong decisions. |
| Confuse Bloom levels | "What is it?" and "What should we build?" need different answers. |
| Skip the codebase | The project already has constraints, tokens, and decisions. |
| Stop at Understand when user needs Create | Every level must be climbed explicitly. |
| Propose a creative solution without verifying feasibility | Creativity without constraints is daydreaming. |

## Common Rationalizations

| User says | Respond with |
|---|---|
| "Tìm hiểu X" | "What level do you need: ghi nhớ, hiểu, vận dụng, phân tích, đánh giá, hay sáng tạo?" |
| "Tại sao lại thế này?" | "Let's check the codebase and 2–3 authoritative sources before answering." |
| "Em nghĩ sao?" | "I'll separate what I know (fact), what I infer (analysis), and what I propose (creation)." |
| "Có cách nào mới không?" | "First we verify what exists; then we combine the pieces into a new pattern." |

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
- [ ] Output includes at least one template (Knowledge Brief or Question Ladder).
- [ ] Next action or skill is named (e.g., `design-from-idea`, `audit-ui-ux-then-redesign`, `spec-driven-development`).

---

## Router Boomerang

- Need a UI design brief? → `design-from-idea`.
- Need to audit existing UI before designing? → `audit-ui-ux-then-redesign`.
- Need to implement the answer? → `frontend-ui-engineering`, `source-driven-development`, or `spec-driven-development`.
- Need to extract requirements from a vague human? → `interview-me` or `elicitation`.
- Need to stress-test the idea before committing? → `doubt-driven-development`.
