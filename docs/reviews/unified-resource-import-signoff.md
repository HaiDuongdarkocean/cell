# Sign-off — unified-resource-import

Date: 2026-10-04 · Mode: interactive

## Approval chain

- Intent approved by user: goal stated explicitly — "gộp thành một nơi để import… bản chất frequency list cũng là một dạng dictionary nên chúng ta có thể lấy kiến trúc của dictation để chứa frequency list" — recorded in `docs/intent/unified-resource-import.md` + `docs/reviews/unified-resource-import-analyze.md`.
- Design approved by user on rendered mockup (`src/entrypoints/mockup-unified-resource-import`, served at localhost:5173): concept **A — "Một dãy sách"** chosen over B/C — one flat unified list, one dropzone, live intake rows, component chips. `docs/reviews/unified-resource-import-design.md` VERDICT: APPROVE.
- Spec reviewed adversarially — `docs/reviews/unified-resource-import-spec.md` VERDICT: APPROVE_WITH_CHANGES (blocker + 5 majors all fixed in spec before design).
- Code verified by fresh-context review — `docs/reviews/unified-resource-import-verify.md` VERDICT: PASS (round 2; round-1 blocker on always-transmitted `components` subset + type-branch + missing migration tests all fixed and re-verified).
- Browser evidence: showcase e2e `e2e/showcase-unified-resources.spec.ts` 4/4 — one section/dropzone/flat list, txt→frequency card, mixed zip→both chips, aria-pressed toggles. Screenshots `tmp/unified-resource-import/01-03*.png`.
- Gates: typecheck / lint / test:unit (670 suites, 7912 tests) / build / browser — all pass, recorded on committed state.

## Scope delivered

- One dropzone, one flat resource list; `components[]` derived from file content (format map + zip bank paths + sqlite schema strings), strategy-authoritative emit.
- Unified entry store (schema v14): freq rows = `{kind:'freq'}` in `langDictionaryEntry`; atomic abort-safe migration; `langFrequencyEntry` store dropped.
- Mixed files (term-bank zip, dual-table sqlite) import both families in one pass; `type` reduced to derived label via `deriveResourceType`.
- Single priority axis; `disabledComponents` honored in lookup merge + `FREQUENCY_GET`; `resourceOffersComponent` shared predicate.
- Background-capable: registry job + importing-card handoff; panel-close continues.
- Sync compat: portable `{dictRows,freqRows}` partitioned by `kind`, `contentHash` unchanged; blob import derives components.

VERDICT: SIGN_OFF
