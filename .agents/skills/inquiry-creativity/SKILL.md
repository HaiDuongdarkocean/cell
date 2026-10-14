---
name: inquiry-creativity
description: Turn a vague topic into sharp questions and verified knowledge. Use to research a domain or generate solutions from first principles.
---

# Inquiry & Creativity — Bloom + Critical Thinking + 4-Step Knowledge Distillation

> **Asking is a skill. Creating is connecting. Deciding is weighing.**

Turns any topic into precise questions → verified knowledge from **two sources** (codebase SSOT + internet) → an original, well-justified decision.

## When to Use

- Vague topic + "tìm hiểu" / "hãy hỏi"; wants better questions before designing/deciding
- Creative solution needed but no raw idea exists; domain keyword → verified design input
- Choosing between A and B with a rigorous, project-aware justification

## When NOT to Use

- Concrete bounded task → just do it. Single fact → `web_search` directly. Code → `pipeline-specify`/`source-driven-development`. UI feeling → `pipeline-design`. UI audit → `audit-ui-ux-then-redesign`.

## Core principle

> **Creativity is connecting verified facts in a new pattern. Decision is picking the idea that best fits the constraints — not the "best" idea.**

## Source policy (non-negotiable)

Every topic answered from **both**: (1) codebase — `docs/`, `src/shared/`, `AGENTS.md`, `.agents/skills/clean-design/knowledge/` (design canon) with file:line; (2) internet — `web_search` + `webfetch` 3–5 sources, SIFT-verified. **Conflict → codebase wins for project decisions, internet wins for domain principles.** State and resolve the conflict.

## Workflow

```text
1. Scope (5W1H + Bloom target) → 2. Query (Boolean) → 3. SIFT sources
→ 4. Synthesize to Bloom target → 5. Critique & converge → 5.5 First-principles check
```

| Step | Done when |
|---|---|
| 1. Scope | Topic + Bloom target ("là gì"→Remember/Understand, "làm thế nào"→Apply/Analyze, "có nên"→Evaluate, "tạo ra"→Create) + output form stated in one sentence |
| 2. Query | `"keyword" AND (support1 OR support2) NOT noise` — same Boolean mindset for `grep` and `web_search`; not too broad/narrow |
| 3. SIFT | 3–5 sources ranked: `high` (official/spec/research) / `medium` (known author) / `low` (blog). Codebase sources checked for currency + SSOT status |
| 4. Synthesize | Answer reaches the Bloom target; ≥1 codebase or high-authority source cited; zero unverified claims |
| 5. Converge | ≥3 options (A, B, + generated C/D/E); must-haves vs nice-to-haves; weighted matrix (weights sum 100%, criteria map to project constraints); confidence + main risk per option; 5 Whys on the winner |
| 5.5. First-principles | Unconstrained ideal described without naming current tools; scored on the relaxed matrix; **tie → the unconstrained best practice wins** + migration path; constrained win → document "we accept X because of Y; ideal is Z" |

**Stop rule:** top option ≥80% fit and no clearly better option after 5 Whys → stop, propose a small reversible experiment. Top two within 10% → another 5-Whys round or ask risk tolerance.

→ Full step actions, SIFT detail, question bank: `references/method-detail.md`
→ Output templates (Knowledge Brief, Question Ladder, Critical Decision Brief) + rationalization responses: `references/templates.md`

## Anti-patterns (top offenders)

- Answering from memory; single source; skipping SIFT; skipping the codebase
- Confusing Bloom levels ("what is it" vs "what should we build" need different answers)
- Binary A-or-B without generating C; unweighted scoring; decision without naming the risk
- Iterating past 80% fit without an experiment (analysis paralysis)
- Skipping the first-principles option — current constraints become an invisible ceiling

## Verification

- [ ] Bloom target declared and reached (or gap explained); sources cited with authority scores
- [ ] Decision tasks: ≥3 options, weighted matrix, 5 Whys, confidence + risk stated
- [ ] First-principles option scored; tie-break applied; 80% stop rule respected
- [ ] Output uses a template; next skill named (`pipeline-design`, `pipeline-specify`, ...)

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. UI brief → `pipeline-design`; implement → `pipeline-specify`; extract requirements → `interview-me`/`elicitation`; stress-test → `doubt-driven-development`.
