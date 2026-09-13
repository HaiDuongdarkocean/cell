# Inquiry & Creativity — output templates

## Template 1 — Knowledge Brief

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

## Template 2 — Question Ladder

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

## Template 3 — Critical Decision Brief

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
- **Re-scored (relaxed local constraints):** ...
- **Comparison to constrained winner:** tied / higher / lower by ...
- **Tie-break rule:** if tied, choose the unconstrained best practice.

## Verdict
[Option X, 80% fit, experiment is ..., and the ideal target is Y]
```

## Common rationalizations

| User says | Respond with |
|---|---|
| "Tìm hiểu X" | "What level do you need: ghi nhớ, hiểu, vận dụng, phân tích, đánh giá, hay sáng tạo?" |
| "Tại sao lại thế này?" | "Let's check the codebase and 2–3 authoritative sources before answering." |
| "Em nghĩ sao?" | "I'll separate what I know (fact), what I infer (analysis), and what I propose (creation)." |
| "Có cách nào mới không?" | "First we verify what exists; then we combine the pieces into a new pattern." |
| "Chọn A hay B?" | "Let's define must-haves, find a third option, score with weights, and name the risk." |
| "Cứ làm theo ý anh đi" | "Let's verify the constraints first, or we may build something the design system rejects." |
| "A ràng buộc hơn nhưng dễ làm" | "Let's score the unconstrained best practice too. If it ties or wins, we prefer it and design a migration path." |
