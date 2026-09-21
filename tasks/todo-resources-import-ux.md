# Todo — resources-import-ux

- [ ] T1 REQ-2: exact entry totals — `BatchProcessor` total, `reportTotal`, per-format counting (txt/json-entries/wordlist/json-array/sqlite/term-bank), orchestrator forwards total (AC: SC-2)
- [ ] T2 REQ-1: `importResourceFile` `options.jobId` contract (AC: SC-1)
- [ ] T3 REQ-1/3/4/5: `ResourcesPanel` job model + bounded scheduler (MAX_CONCURRENT_IMPORTS=2, ~256MB bytes), signature dedupe, per-job duplicate prompt, soft refresh, aria-live (AC: SC-1, SC-3, SC-4, SC-5, SC-6)
- [ ] T4 REQ-1/4: water-fill job rows (`ImportProgress` rework + CSS) (AC: SC-1, SC-2, SC-4)
- [ ] T5 REQ-6: `ResourceCard` `DragHandle` pointer-drag reorder + keyboard arrows + persist (AC: SC-7)
- [ ] T6 REQ-7: remove "Thử tra từ" from `ResourceDetail` (AC: SC-8)
- [ ] T7 REQ-7: `dictionaryPopup/index.ts` barrel + `SettingsDialogContent` two-column lookup + `installationFinished` exclusion + send-to-card gating check (AC: SC-8)
- [ ] T8 mock parity: `mockDictionary` emits per-job progress phases (AC: SC-9)
- [ ] T9 unit tests: counting per format, scheduler bounds, job lifecycle, reorder, removed lookup
- [ ] T10 gates: `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] T11 fresh-context verify → `docs/reviews/resources-import-ux-verify.md` VERDICT: PASS
- [ ] T12 real-Chrome verify (drop ≥2 dicts, overlap, drag persist, lookup) + `docs/2-architechture-system.md` + wiki changelog
- [ ] T13 sign-off → `transition --to shipped`; delete `src/entrypoints/mockup-resources-import-ux/`; backlog row → shipped
