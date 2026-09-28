# Analyze review — durable-job-registry

> Mode: interactive · Artifact: `docs/intent/durable-job-registry.md` · Reviewer: owner (Anh) via interactive thread

## Decisions captured from owner (2026-09-28)

- Problem statement accepted verbatim: closing the Universal Panel mid-import loses the process and reopening shows nothing ("khi mở ra sẽ không còn thấy nó nữa")
- Mechanism direction approved: "tôi muốn một cơ chế có thể giải quyết vấn đề này hãy đưa ra cơ chế phù hợp nhất" → owner confirmed the JobRegistry proposal
- Scope extended by owner: not only dictionary imports — "cùng với các tính năng tải nạp, download hay xóa khác" → audit widened to all 12 Settings cards
- Go decision: "có" after the full Settings audit matrix was presented (3 defect classes: silent death, invisible run, lost result-write)

## Findings from the Settings-wide audit (accepted by owner)

- Already durable — do not rewrite: media `downloadQueue` (session persistence + `performSessionRestore`), sync obligations/checkpoints/rebind
- Gap A (silent death): `RESOURCE_IMPORT_CHUNK` upload phase — sender-owned, `pendingImports` TTL orphans
- Gap B (invisible run): import parse, `RESOURCE_DELETE` cascade, `TTS_DOWNLOAD_VOICE`, `LOCAL_AUDIO_BUILD_INDEX` — work continues without a queryable record; SW idle-kill risk
- Gap C (lost result-write): TTS `downloadedLanguages`, DSL `lastIndexedAt` stamped by the caller post-response — caller death loses the write

## Checklist

- [x] Need ≠ solution ≠ value (need is observable panel-close harm, not "a job system")
- [x] All five stakeholder groups addressed
- [x] Journey AS-IS + TO-BE complete, TO-BE ends at the value
- [x] ui_surface=yes consistent with job-row/interrupted-state UI steps
- [x] Decision go supported by risk register + evidenced defects

VERDICT: APPROVE
