# Plugin: Survey Questionnaire

> Load when user references other stakeholders who aren't present. Don't interview one person about another's needs.

## When to Load

- User says "team tôi", "người dùng của tôi", "khách hàng" → multiple stakeholders
- User says "tôi không biết, nhưng [người X] biết" → domain expert absent
- User says "tôi cần hỏi [nhóm] trước khi quyết" → group decision
- Domain expert not available real-time → async needed

## Generate Questionnaire

**Grill the send, not the subject.**

Ask the USER about the RECIPIENT (not about the topic):

1. Who is the recipient? Role, expertise, relationship to user?
2. What decisions or facts do you need back from them?
3. When do you need their response? (deadline)
4. How many recipients? (1-on-1 or group?)

Then generate markdown questionnaire:

```markdown
# [Topic] — Questionnaire for [Recipient Role]

> Context: [why asking]
> Deadline: [when]
> From: [user name/role]

## [Theme 1 — most important first]

1. [specific question]
2. [specific question]

## [Theme 2]

3. [specific question]
```

**Rules:**

- Questions ordered most-important-first (async = may only get 1 pass)
- Group under `##` headings by theme
- Each question: specific, actionable, not abstract
- No more than 10 questions total

**Guard:** User confirmed recipient role + what's needed before generating.

**Loop back:** If user can't describe recipient, ask: "If you could only ask them one thing, what would it be?"

## Save + Deliver

1. Save to `docs/intent/[topic]-questionnaire.md`
2. User delivers to stakeholder (email, message, meeting)
3. Stakeholder fills in async or live
4. User returns filled doc

## Synthesize Responses

**Extract requirements from filled questionnaire.**

1. Read filled questionnaire
2. Extract each answer → map to information frame field
3. Identify conflicts between stakeholders (if multiple)
4. Present conflicts to user: "[Person A] says X, [Person B] says Y. Anh chọn?"
5. Fill frame with resolved answers

**Guard:** Every answered question mapped to a frame field or explicitly discarded with reason.

**Loop back:** If conflicts unresolved, continue interview with user to resolve.

## Output

Filled frame fields from questionnaire responses.

Conflicts surfaced + resolved.

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Ask user about recipient's needs | User doesn't know — that's why you need questionnaire |
| Abstract questions in questionnaire | Recipient can't answer async — be specific |
| 20+ questions | Async = may only get 1 pass — prioritize |
| Don't follow up on conflicts | Silent disagreement becomes spec error |
| Generate without confirming recipient | Wrong tone, wrong context, wasted pass |

## Verification

- [ ] Recipient role + needs confirmed before generating
- [ ] Questions ordered most-important-first
- [ ] ≤10 questions total
- [ ] Saved to `docs/intent/[topic]-questionnaire.md`
- [ ] Responses synthesized into frame fields
- [ ] Conflicts surfaced and resolved
