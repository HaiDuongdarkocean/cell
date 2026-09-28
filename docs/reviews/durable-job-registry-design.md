# Design review — durable-job-registry

> Artifact: `docs/intent/durable-job-registry-design-brief.md` + `docs/intent/durable-job-registry-component-mapping.md` · Mockup: `src/entrypoints/mockup-durable-job-registry/` (dev server, A/B/C switcher) · Reviewer: owner (Anh)

## Decision captured from owner (2026-09-28)

Question presented: "Job state (nạp từ điển, tải giọng đọc, xóa resource, build index…) nên hiển thị ở đâu trong Settings?"

- **Chosen: A — Inline rows.** Job rows live inside their owning Settings card (Resources → import/delete rows; Audio → voice/index rows). No global aggregation surface in this item.
- Rejected: B (Activity center — one feed, detached from retry inputs), C (Hybrid — extra sidebar chip surface; owner prefers minimal variance).

## Consequences recorded

- Function↔feature map in the spec stays valid: per-kind surfaces, no task-center feature.
- `JOB_LIST`/`JOB_EVENT` still serve all kinds — surfaces simply render only their own kinds.
- Retry/dismiss affordances live beside the input that retries (re-import needs the dropzone — aligned with A's strength).

## Checklist

- [x] Brief + mapping + mockup exist at canonical paths
- [x] Every element has reuse/extend decision + token + icon (no `create` — all shared `ui/` components)
- [x] Interactions trace: start→row (REQ-1), reopen→JOB_LIST rows (REQ-3), retry (REQ-8), dismiss (REQ-7)
- [x] aria-live on job rows; icon-only buttons carry aria-labels; ≥44px touch
- [x] No Liquid Glass; tokens from `tokens.json` only
- [x] `check-design-brief.mjs durable-job-registry` → `design brief ok — 16 tokens, 6 components, 5 icons · VERDICT: PASS` (VStack→Stack fix applied 2026-09-28)

VERDICT: APPROVE
