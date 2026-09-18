---
name: spec-review-stakeholder
description: Adversarial BA/PO/TL review of a spec before implementation. Use to sanity-check a spec.
---

# Spec Review → `pipeline-specify` gate

**Absorbed.** Adversarial spec review is now the SPECIFY stage gate inside
`pipeline-specify` — the `spec-reviewer` agent emits `docs/reviews/<slug>-spec.md`
with `VERDICT:`; `pipeline-state.mjs transition` validates it (fresh + APPROVE/
APPROVE_WITH_CHANGES). Reviewer prompts live under `.agents/agents/spec-reviewer*`.

Kept as a stub so `/spec-review-stakeholder` and old references still resolve.
