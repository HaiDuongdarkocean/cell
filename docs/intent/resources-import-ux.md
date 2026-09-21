# Intent: Resources import UX — per-file parallel import progress, drag reorder, integrated test lookup

> Slug: `resources-import-ux` · Mode: interactive · Source: user statement (this thread, 2 screenshots)
> ui_surface: yes          ← consumed by specify→design|deliver routing
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | When importing several dictionaries at once the user cannot tell what is happening: one shared progress line for the whole batch, a denominator hardcoded to 100 while the numerator counts real entries ("Đang thêm… 10000 / 100 mục"), files processed one-by-one so a 6-dictionary drop takes minutes serially, and no per-file success/failure signal — plus no way to verify an imported dictionary actually answers lookups without expanding each card and using a per-resource "Thử tra từ" box. | User statement + screenshot (quetta_FNuyxHEUac.png shows "Đang thêm…10000 / 100 mục"); `progressTotal: 100` hardcoded at `src/features/dictionary/ui/ResourcesPanel.tsx:317`; sequential `for` loop at `ResourcesPanel.tsx:364-374`; single `ImportState` per section (`ResourcesPanel.tsx:63-80`); per-resource test lookup at `src/features/dictionary/ui/ResourceDetail.tsx:139-169` | high |
| Change | One shared per-section progress line + sequential loop + up/down reorder buttons + per-resource test-lookup → a list of per-file import items each with its own real-time progress (entries processed / real entry total), files imported in parallel without blocking the panel, each item resolving to its own success/error; a left-edge drag handle for reorder; the per-resource lookup box removed in favor of a dictionary lookup surface beside the resource lists that queries all enabled dictionaries and frequency lists. | User statement enumerates all six deltas; progress plumbing already carries a `total` field that is never populated (`resourceClient.ts:171-175`, `resources.ts:199` — `estimatedTotal` always undefined because `BatchProcessor.onProgress` only reports processed, `batchProcessor.ts:39`) | high |
| Solution | Direction: per-file import job state in the panel (each dropped file = a row with spinner/progress + own outcome); strategies report an entry total (exact pre-count where cheap, else streamed estimate) through the existing progress channel; parallel `importFile` jobs with bounded concurrency; pointer-based drag reorder on a grip handle (up/down buttons retained for keyboard/a11y); right-hand column hosting the existing integrated dictionary view so typed text runs real lookups across active resources. | `pendingImports` map in `resources.ts:53` is already keyed by `jobId` — concurrent chunk uploads are structurally supported; `DictionaryPanelView` already has `variant='integrated'` with its own search field + history (`DictionaryPanelView.tsx:56-57,285-299`) | medium |
| Value | Import of a multi-dictionary set stops being a blind wait — the user sees each file's real progress, knows exactly which one failed and which succeeded, finishes faster, and can immediately prove a dictionary works by typing into the test panel. Reorder becomes one drag instead of N clicks. | User statement: "quá trình thêm vào hệ thống cần phải căn cứ vào entry", "hiển thị có những items nào đang được load", "khi xong cái nào phải phản hồi đúng cái đó" | high |
| Stakeholder | Anh (owner/developer, also the primary user) importing 6 large normalized dictionaries (50–160MB each per screenshot); downstream: any learner managing resources. | File Explorer screenshot: 6 × `*.normalized.json`, 40–160MB | high |
| Context | Chrome MV3; imports run in the background SW fed by base64 chunks over extension messages (`resourceClient.ts:180-202`); each in-flight job holds the full decoded file in memory — unbounded parallelism with 160MB files risks SW memory pressure on the 1GB-RAM persona, so concurrency must be bounded. Working tree currently holds another agent's uncommitted dictionary refactor (renamed strategies, `importOrchestrator.ts`, `ResourcesPanel.tsx` dirty) — delivery must not trample it. | `git status` this session; persona RAM ≥1GB (`AGENTS.md`); chunk accumulation `resources.ts:180-192` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainer + agents | Parallel imports must not corrupt IndexedDB or OOM the SW; progress totals must stay honest across all 6+ import formats | Strategies share `BaseImportStrategy`/`BatchProcessor` — one seam for totals; bounded-concurrency queue is a small pure structure |
| Customer | Learner importing dictionaries/frequency lists | See what is loading, how far, and the outcome per file; keep using the panel while imports run; verify a dictionary by typing a word | Panel is inside the settings dialog — must stay interactive during import; drag reorder needs a keyboard-operable fallback |
| Supplier/Dependency | Chrome extension messaging + IndexedDB | Chunked upload channel and IDB must tolerate N concurrent jobs | `pendingImports` keyed by jobId already isolates jobs; IDB writes per resourceId are independent |
| Organization | Future contributors | Import-state shape documented; per-file job lifecycle consistent between real path and showcase mocks | `design-system-showcase/mockDictionary.ts:351` mocks `RESOURCE_IMPORT_CHUNK` — mock must grow per-job progress too |
| Regulator | Chrome Web Store policy | none — no new permissions, no network | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Each dropped file must appear as its own list item with its own live status — the user can see which files are queued/loading/done/failed at a glance | F, U | User statement ("màn hình sẽ hiển thị có những items nào đang được load"); Yomitan-style reference screenshot | high |
| N2 | Import progress must be denominated in real entries (e.g. "12,340 / 73,643 mục"), not a fixed /100 | F | `progressTotal: 100` hardcode at `ResourcesPanel.tsx:317`; user statement ("có 10000 entry thì phải là 0 / 10000") | high |
| N3 | Files dropped together must import in parallel, not one-after-another | F, P | Sequential loop `ResourcesPanel.tsx:367-372`; user statement ("đang tuần tự chứ không phải song song") | high |
| N4 | The panel must stay interactive while imports run — no blocking the screen, and dropping more files during an import must still work | U, R | `Dropzone disabled={state.importing}` at `ResourcesPanel.tsx:204`; user statement ("phải đảm bảo không block màn hình") | high |
| N5 | Each item must resolve to its own outcome — success (with entry count), failure (with message), or duplicate prompt — independently of sibling imports | F | User statement ("khi xong cái nào phải phản hồi đúng cái đó"); today's duplicate prompt is one shared slot per section | high |
| N6 | Reordering a resource must be possible by dragging a handle at the left edge of its row | F, U | User statement + reference screenshot (grip icon left edge); today: two chevron buttons `ResourceCard.tsx:89-112` | high |
| N7 | A lookup surface beside the resources list must let the user type/edit arbitrary text and see real results drawn from the imported dictionaries and frequency lists — replacing the per-resource "Thử tra từ" box | F, U | User statement ("xóa bỏ tính năng thử tra từ … tích hợp dictionary ở bên phải resources … viết chữ thay đổi chữ để tìm những kết quả khác nhau"); per-resource lookup to remove: `ResourceDetail.tsx:139-169` | high |
| N8 | Parallel import must not exceed memory the SW can hold — concurrency bounded, not "all files at once" | R, P | `[assumption]` — 6 × ~160MB decoded+b64 in one SW can OOM low-RAM devices; persona floor is 1GB RAM | medium |
| N9 | Progress total is the file's real entry count, known before/at the start of insertion — every format gets a pre-count pass (txt: line count; sqlite: COUNT query; zip: per-bank entry counts; JSON: array-length pre-parse, ~1s on 90MB accepted) | F | User decision (exact count over byte-estimate/hybrid) | high |

## Scope

- **In:**
  - Per-file import job model in `ResourcesPanel`: each dropped/picked file renders a row (name + progress bar or spinner + processed/total entries + per-item outcome: success count, error, duplicate prompt).
  - Real entry totals plumbed end-to-end: strategy/orchestrator → `RESOURCE_IMPORT_PROGRESS` (existing `total` field) → per-item UI. Exact pre-count where cheap; honest indeterminate state where not.
  - Parallel imports across files with a bounded concurrency cap; dropzone stays enabled during import; panel never blocks.
  - Drag-handle reorder on resource rows (left edge), persisting via existing `reorderResources`; keyboard-accessible reorder preserved.
  - Remove the per-resource "Thử tra từ" lookup inside `ResourceDetail` (sample entries + profile picker stay); add a lookup surface to the right of the resource lists reusing `DictionaryPanelView` `variant='integrated'` (search field + history + full `CandidateView` results — same fidelity as the video popup, per user decision) that runs real lookups against enabled dictionaries + frequency lists and reflects edits as the user types.
  - Showcase/mock path parity for the new per-job progress messages.
  - Build proceeds on top of the current dirty working tree (user decision) — the uncommitted tihoka dictionary refactor is the accepted base; commits must stage only this item's hunks.
- **Out:** cancel-import button per job (not requested — jobs aren't abortable today end-to-end); import of folder/multiple zip levels; changes to what formats are supported; reordering across sections; the Card Creator pipeline.
- **Non-goals:** not a rewrite of the import strategies or repositories; not a service-worker/offscreen-document move of import work; not making imports resumable across reloads.

## Workflow

The user opens Settings → Resources and drops six dictionary files onto the dropzone. The list immediately shows six new import rows, one per file. A bounded number start parsing at once; the rest show as queued. Each row's progress reads "34,021 / 73,643 mục" as entries stream into IndexedDB — the user can keep scrolling, toggling resources, or drop more files; nothing freezes. A file that is a duplicate pauses its own row with a replace/skip prompt while siblings keep going. Each finished row flips to its own result — "Đã thêm X từ" or an error line naming that file — and the imported resource takes its place in the list. Later, the user grabs the left-edge handle on a resource row and drags it above another to change priority. To verify a dictionary, they type into the lookup field beside the lists — results from all enabled dictionaries and frequency lists update as the text changes.

## Journey

### AS-IS

1. User drops 6 dictionary files; the section shows a single shared progress line — no list of what is being imported.
2. Progress reads "Đang thêm… 10000 / 100 mục" — numerator counts real entries, denominator is a hardcoded 100.
3. Files import one at a time; a 6 × 50–160MB batch serializes into minutes; the dropzone is disabled for the whole duration.
4. One file failing aborts the rest of the batch (`if (!ok) break`); a duplicate prompt blocks the single shared state slot.
5. User cannot tell which file is which until the batch finishes; success feedback is one message for whichever file just ended.
6. To sanity-check a dictionary, the user expands its card and uses the per-resource "Thử tra từ" box — one resource at a time.
7. Reordering means clicking up/down chevrons once per position moved.

### TO-BE

1. User drops 6 dictionary files; six rows appear immediately, each labeled with its file name and own status (queued → loading → done/error).
2. Each row shows real entry progress — "34,021 / 73,643 mục" — with a determinate bar once the total is known, honest spinner before.
3. Imports run in parallel under a bounded concurrency cap; the dropzone stays live and the panel never blocks — more files can be dropped mid-import.
4. A failing file marks only its own row; siblings continue. A duplicate prompt attaches to that file's row and resolves it alone.
5. Each finished row reports its own outcome ("Đã thêm 73,643 từ" / error message), and the resource list reflects each completion as it lands.
6. The user drags a row's left-edge grip to reprioritize it in one gesture; keyboard users still have operable reorder controls.
7. The user types any word into the lookup field beside the lists and sees real results across all enabled dictionaries and frequency rankings — the per-resource test box is gone.

## Stories

- S1: As a learner importing several dictionaries, I want to see each file as its own progress item so that I know exactly what is loading — done when every dropped file renders a row whose status updates independently.
- S2: As a learner, I want progress measured in real entries so that "73,643 entries" means 73,643 — done when the denominator equals the file's true entry count and the bar is determinate once known.
- S3: As a learner, I want my files to import concurrently so that a batch finishes in the time of its slowest members, not their sum — done when >1 file imports at once (bounded) and total wall time drops vs sequential.
- S4: As a learner, I want to keep using the panel during import — done when dropzone, toggles, reorder, and lookup all work while imports run.
- S5: As a learner, I want per-file outcomes — done when a failure or duplicate prompt on file A neither masks nor aborts file B.
- S6: As a learner, I want to drag a resource row to reorder it — done when a left-edge handle reorders on drag and persists via `reorderResources`.
- S7: As a learner, I want to type arbitrary text and see real dictionary+frequency results beside my resources — done when edits to the field re-query all enabled resources and the old per-resource lookup is removed.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Unbounded parallel imports OOM the SW (6 × ~160MB decoded + base64 strings) | internal | SW crash mid-import, rolled-back jobs | Good — bounded concurrency cap + sequential chunk upload per job already in place |
| Concurrent IDB writes across strategies interleave poorly (transaction contention, quota) | internal | slower-than-expected parallel, quota errors | Medium — Dexie serializes transactions per store; verify on real 6-file import; cap can be lowered |
| Exact entry totals cost a second pass over big files (JSON 90MB) | operational | progress starts a beat later | Good — per-format count strategy: cheap counts (lines/COUNT/zip index) exact; expensive formats show indeterminate → or byte-position estimate |
| Dirty tree: another agent's uncommitted dictionary refactor touches the same files (`ResourcesPanel.tsx`, `importOrchestrator.ts`, strategies) | hidden/operational | merge conflicts, stomped work | Medium — surface at gate; likely build on top after confirming the refactor is stable, or sequence after its commit |
| Integrated dictionary panel in settings context needs props (sourceLang/targetLang, card-creator callbacks) that don't exist there | internal | heavier wiring than expected | Medium — panel's callbacks are optional; worst case a slim lookup view reusing `useDictionaryLookup` + `CandidateView` |
| Drag reorder + existing priority sort can desync optimistic order vs persisted | internal | row jumps back after drag | Good — `sortByPriority` + `reorderResources` contract already exists; reuse it |

## Decision

go — all six asks trace to concrete, evidenced defects/gaps in `ResourcesPanel`/`importOrchestrator`; the progress plumbing and job-keyed upload channel already anticipate the fix; value is immediate and user-facing.

## Draft Acceptance Criteria

- [ ] Dropping N files renders N independent progress rows; each row shows processed/total entries with the file's real total once known.
- [ ] >1 file imports concurrently (bounded cap); measured wall time for a multi-file batch < sequential baseline; UI stays interactive throughout.
- [ ] Per-file outcome: success shows its own word count; failure names that file only; duplicate prompt resolves only its file; a failure never aborts siblings.
- [ ] Resource rows have a left-edge drag handle that reorders and persists; keyboard reorder remains available.
- [ ] Per-resource "Thử tra từ" removed; a lookup field beside the lists queries all enabled dictionaries + frequency lists and updates as the text changes.
- [ ] `npm run typecheck && npm run test:unit && npm run build` green; verified on real Chrome with a multi-file drop.
