# BACCM Inference + Hypothesis Presentation

> Load during Phase 1 (business case) and again before presenting the hypothesis. BACCM is an **inference engine**, not a checklist — the six concepts define each other; a gap in one means the analysis has a blind spot.

## The six concepts

| Concept | Question it answers | Where it lands in the intent doc |
|---|---|---|
| **Need** | What problem or opportunity is addressed? | Business Case → Needs list |
| **Change** | What is transforming (current → future)? | Workflow AS-IS vs TO-BE |
| **Solution** | What direction satisfies the need? | Scope + Decision lean |
| **Value** | What is it worth, to whom, in this context? | Business Case → Value |
| **Stakeholder** | Who has a relationship to the change? | Stakeholders section |
| **Context** | What circumstances constrain the change? | Constraints + Risks |

## Inference procedure

For each concept, **infer first, cite evidence, mark confidence**:

1. Draft the concept from what exists: backlog row (`Pain`, `Infra`, `Source`), user statement, codebase (`file:line` citations), `docs/context/project-context.md`, domain docs.
2. Tag every inference `confidence: high|medium|low`. Low → candidate question for the user (interactive) or `[assumption]` (all mode).
3. Cross-check the concept against its five siblings — a Need that reads like a Solution, or a Value with no stakeholder, is a defect.

### Need vs value vs solution — the trap

- **Need** = the pain or opportunity itself ("mất 10 phút tua lại vì không nhớ chỗ dừng").
- **Value** = the worth the stakeholder gets ("xem thêm 2 tập/tuần").
- **Solution** = a direction ("resume point tự động").

`"quản lý project chặt và đúng hẹn"` is **value** language — the need under it is the pain causing missed deadlines. `"tôi muốn OCR"` is **solution** language — re-elicit the need (can't read foreign text). Never write a value or a solution into the need slot.

### Stakeholder coverage

BACCM Stakeholder = every group with a relationship, not one persona:

- **Team** — capability, capacity, time. "Can we build this?" is a stakeholder question.
- **Customer/end user** — primary persona (age 5–80, device spread per AGENTS.md).
- **Supplier/dependency** — external APIs, data sources, platform (Chrome MV3 limits).
- **Organization** — maintainers, future contributors.
- **Regulator** — licensing, legal, policy, store compliance.

Missing stakeholder info → explicit assumption or persona in the doc. Never silent.

## Hypothesis presentation

Elicitation is **presenting a drafted analysis for correction**, not interrogation:

```
1. Analyze available info (BACCM inference above)
2. Identify stakeholders + each stakeholder's needs
3. Draft solution direction (1–2 candidates, mark lean)
4. Present the hypothesis:
   ┌─ Business case (6 concepts, evidence-cited)
   ├─ Stakeholder map
   ├─ Draft needs (FURPS+ classified)
   ├─ AS-IS + TO-BE journey sketch
   └─ Decision lean (go / no-go / defer) + why
5. Ask ONLY the questions that resolve real gaps:
   - a low-confidence inference that changes scope
   - a stakeholder need the evidence can't settle
   - a legal/policy constraint unknown to the codebase
6. User confirms/corrects → update doc → approval record
```

A question that the analysis could answer itself is waste. A gap the analysis can't close is a real question — those are the only ones worth asking.

## Self-interrogation (`all` mode)

Same loop, no user. Before writing the doc:

- [ ] Every inference cites `file:line` evidence or is tagged `[assumption]`
- [ ] Need ≠ value ≠ solution for every entry
- [ ] All 5 stakeholder groups addressed (empty Tihoka = explicit "none — why")
- [ ] TO-BE journey ends where the promised value lands
- [ ] Decision lean justified by the risk register, not by enthusiasm
- [ ] Conservative option chosen for every genuine fork; recorded as accepted risk
- [ ] ui_surface decided from journey steps (any user-visible step → yes)

Then the `subagent_explore` audit is the fresh-context check — it must be able to falsify claims, not just summarize the doc.
