# Plan — resources-import-ux

> Spec: `docs/specs/resources-import-ux.md` · Design: `docs/intent/resources-import-ux-design-brief.md` (Concept B — Water fill, approved) · Mapping: `docs/intent/resources-import-ux-component-mapping.md`

## Slices (ordered; each ends green: typecheck + targeted unit tests)

### 1. Exact entry totals through the stack — REQ-2
- `BatchProcessor`: carry a `total` (0 = unknown); `setTotal(n)`; `onProgress(processed, total)` signature widened.
- `BaseImportStrategy`: `reportTotal(n)` helper → `batchProcessor.setTotal`.
- Per-format counting, emitted before first insert:
  - `TxtLineStrategy` (incl. gz/zip): non-empty line count after decode.
  - `JsonEntriesStrategy` / `WordlistJsonStrategy`: parsed array/`list` length.
  - `JsonArrayStrategy`: regex-match count pass over decoded text.
  - `SqliteStrategy`: `SELECT COUNT(*)` on the table actually selected (`langResourceEntry` dict; `langFrequencyEntry` w/ `entries` fallback for frequency).
  - `TermBankStrategy`: count pass over bank files with mode filter (`term_bank_*` all rows; `term_meta_bank_*` only `type==='freq'`).
- `importOrchestrator`: stop narrowing `onProgress` to `(processed)` — forward `(processed, total)`.
- Tests: per-format totals asserted from strategy fixtures; no `/100` anywhere.

### 2. Client job contract — REQ-1
- `resourceClient.importResourceFile`: accept `options.jobId` (panel mints), keep internal mint as fallback; keep `onProgress(processed, total)` (total=0 → indeterminate).
- Tests: provided jobId used in chunk messages + progress filtering.

### 3. Panel job model + bounded scheduler — REQ-1, REQ-3, REQ-4, REQ-5
- `ResourcesPanel`: replace per-section `ImportState` with `ImportJob[]` keyed by jobId (`queued → uploading → importing → success|error|skipped`; parked `duplicate` prompt).
- Global FIFO queue across both sections; start when `running < 2` AND in-flight bytes < ~256MB; enqueue signature-dedupe vs queued/running jobs (skipped instantly, no slot).
- Enqueue pre-validation (≤500MB, extension allow-list) → instant error row.
- Per-job `onDuplicate` parks the job; replace resumes same row (guard vs `installationFinished=false`), skip ends as skipped w/ "Thay thế" re-run.
- Soft refresh per completion (never toggles `loading`); success rows auto-dismiss ~4s; errors persist.
- `aria-live` announcements per file; dropzone always enabled.
- Tests: queue bounds, dedupe, per-job outcomes, soft refresh.

### 4. Water-fill job rows — REQ-1, REQ-4
- `ImportProgress` → job-row component: dashed pending card, `--color-primary-subtle` fill rising by %, `processed / total` counter, right-edge spinner → % → terminal icon (`circleCheck`/`alertCircle`/`triangleAlert`), duplicate actions inline.
- Section renders job rows above resource cards; CSS in `ResourcesPanel.module.css`; `prefers-reduced-motion` respected.
- Tests: row states render (queued/counting/progress/done/error/duplicate).

### 5. Drag-handle reorder — REQ-6
- `ResourceCard`: `DragHandle` (shared, `draggable=false` override) at left edge replaces up/down buttons; pointer-drag reorder within section (pointerdown/move/up, `touch-action:none`, translateY + shifted siblings via transforms, `--shadow-floating` lift); ArrowUp/ArrowDown on focused handle = keyboard reorder; persist via `reorderResources` + soft refresh.
- `ResourcesPanel`: `handleReorder(type, fromIndex, toIndex)` → optimistic order → persist.
- Tests: reorder persistence + keyboard path.

### 6. Remove per-resource lookup — REQ-7
- `ResourceDetail`: drop "Thử tra từ" block, `term`/`lookup`/`lookingUp` state, `findDictionaryEntry`/`findFrequencyEntry` imports. Samples + profile picker stay.
- Tests: no lookup input rendered; samples + profiles intact.

### 7. Integrated lookup column — REQ-7
- `src/features/dictionaryPopup/index.ts` barrel exporting `Dictionary`.
- `SettingsDialogContent` resources card: two-column layout (≥720px) — `ResourcesPanel` left, `Dictionary variant="integrated"` right (stacks below on narrow); `sourceLang`=panel langCode, `targetLang`=active profile native (fallback `universalNativeLanguage`).
- `lookupOrchestrator.buildResourceContext`: exclude `installationFinished === false` from `isAllowed`.
- `CandidateView`/`useCandidate`: confirm send-to-card gated on `onSendToCard` presence (quick-add already prop-gated).
- Tests: barrel import resolves; unfinished resources excluded.

### 8. Showcase mock parity — REQ-1 rules, SC-9
- `mockDictionary` `RESOURCE_IMPORT_CHUNK`: accumulate chunks per jobId; on last chunk emit `created`/`progress`/`done` phases through the mocked `onMessage` channel so the showcase exercises identical job-row states.
- Tests/manual: showcase renders queued/progress/done/error rows.

### 9. Gates + verification
- `npm run typecheck && npm run lint && npm run test:unit && npm run build` (+ deep-import/feature-cycle checks).
- Real-Chrome verify per spec DoD: drop ≥2 dictionaries → per-file progress with true totals, overlapped, panel interactive; drag reorder persists; integrated lookup returns results.
- Update `docs/2-architechture-system.md` + `docs/0-wiki.md`; delete `src/entrypoints/mockup-resources-import-ux/` at ship.

### 10. Post-review extension — integrated lookup refresh + management UX (user feedback)
- `resourceClient`: `subscribeResourceChanges`/`notifyResourcesChanged` — every mutation (delete/reorder/setEnabled/setProfiles/import success) notifies same-document listeners.
- `useDictionaryLookup`: `latestLookupRef` stores last request; subscription replays it when the same `langCode` changes → enable/disable refresh integrated results instantly.
- `DictionaryPanelView`: integrated variant restores `searchHistory[0]` on mount when no `initialTerm`/`initialResult`; `.integratedMode` drops `overscroll-behavior:contain` (unbounded panel swallowed wheel); `.lookupColumn` is flex-column so the panel gets a real scroll range.
- Profile scoping removed end-to-end: no `activeProfileId` prop, no `profileIds` lookup filter/probe key, no `ResourceDetail` profile picker, no import auto-scope.
- Resource card: `displayResourceName` strips extension chains; meta = `N từ` (+`đang thêm…`); no `Ưu tiên N`, no format/date; name/meta is a `<button>` (idle → samples detail; edit mode → selection via Card `variant="selected"`); per-card trash hidden while editing.
- `ResourcesPanel` per-section edit mode: pencil button in section header (`aria-pressed`, "Chỉnh sửa/Xong chỉnh sửa"); footer contextual delete — `Xóa n đã chọn` (subset modal) / `Xóa tất cả` (no selection).
- `FrequencyBandsEditor` redesign: title + explanation + labeled rows (name/hint/`top ≤` input) + conditional "Đặt lại mặc định".
- DragHandle dots 3 cols × 2 rows; up/down arrows stay removed (grip + ArrowUp/Down only).
- Rounding: concrete `--radius-lg` on dropzone/cards/skeleton/empty/job rows (`--radius-dialog` doesn't resolve outside `data-theme` scopes → square).

## Dependencies / risks
- Dirty tree contains a foreign in-flight dictionary refactor — stage only this item's hunks at commit; do not touch foreign files beyond what this item needs.
- NFR-3 ≥20% wall-time improvement is a starting bound — tune `MAX_INFLIGHT_BYTES` on real-hardware measurement; record actual delta in spec Open Questions if below.
- Drag reorder uses pointer events (not HTML5 DnD) per learnings `ux-touch-action-none-for-pointer-drag` + `ux-drag-transform-willchange-raf` so touch works.
