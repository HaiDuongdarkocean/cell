---
name: reprompt
description: Reformulate colloquial requests into precise technical prompts. Use when the user says "prompt lại", "nói lại cho dễ hiểu", "viết lại yêu cầu", "sửa lời anh cho chuẩn", or when a request contains vague terms that obscure intent. Not for implementing the request — only for rewriting it.
---

# Reprompt

**Translate vague language into precise technical language before acting.**

## When to Use

- User asks to rephrase their request, or request contains colloquial terms ("bốc cục", "sửa rải rác") lacking technical precision.

## When NOT to Use

- Request is already precise, or user wants implementation not reformulation.

## Workflow

### Step 1: Extract intent → Map terminology
List each vague phrase → infer the technical concept → build mapping table.

| User said (colloquial) | Technical term | Why clearer |
|------------------------|----------------|-------------|
| <vague phrase> | <standard term> | <one-line reason> |

**Guard:** Every vague phrase has a mapped, verifiable technical term.

### Step 2: Rewrite the request
Output the reformulated prompt. Preserve intent, change only language.

> <rewritten request in technical language, actionable without ambiguity>

**Guard:** Another agent could execute the rewritten prompt without asking for clarification.

## Anti-patterns

| Anti-pattern | Fix |
|--------------|-----|
| Changing the user's intent | Preserve intent, change only language |
| Adding scope not asked for | Reformulate only, don't expand |
| Using jargon without mapping | Always show the table — user learns from it |

## Verification

- [ ] Every colloquial phrase mapped to a technical term.
- [ ] Rewritten prompt preserves intent, actionable without ambiguity, table shown to user.

## Router boomerang
Return to `using-agent-skills` — the reprompted request may route to a different skill.
