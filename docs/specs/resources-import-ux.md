# Spec: Resources import UX — per-file parallel import progress, drag reorder, integrated lookup

> Intent: `docs/intent/resources-import-ux.md` · ui_surface: yes · Mode: interactive
> Review: `docs/reviews/resources-import-ux-spec.md` (APPROVE_WITH_CHANGES — fixes applied in this revision)

MoSCoW: all REQs are Must.

## Objective

The Resources panel must make multi-file imports observable and overlapped: every dropped file becomes its own job row with real entry-based progress, jobs overlap under a byte-bounded concurrency cap, the panel never blocks, each job resolves to its own outcome; resource rows gain a left-edge drag handle for reorder; the per-resource "Thử tra từ" box is replaced by a full dictionary lookup column to the right of the resource lists, composed at the settings level via `Dictionary variant='integrated'`.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| User (learner/maintainer) | Drops/picks files; resolves duplicate prompts; drags reorder handle; toggles/deletes/expands resources; types in lookup field | Files, duplicate decision, drag target position, query text | Per-job progress rows (name, processed/total entries, indicator), per-job outcomes, reordered list, lookup results |

The background service worker is system-internal — it processes chunks and emits progress; it is never an actor. No human behavior inside system steps — duplicate resolution enters as actor input to the job.

## Requirements

### Functional

REQ-1: Per-file import jobs with real-time per-job progress
- Actor: User
- Goal: See every file being imported as its own row with live progress
- Preconditions: Settings → Resources open; ≥1 file selected/dropped into a section dropzone
- Basic flow:
  1. actor drops/picks N files into a section's dropzone
  2. system creates one import job per file — minted with a client-generated job id passed into `importResourceFile` (new `options.jobId` contract; the progress listener already filters on it) — and renders one row per job **above the resource cards inside that section's list area**: file name + status + progress indicator at the row's right edge
  3. system starts jobs under the REQ-3 bounds; remaining jobs show `queued`
  4. system updates each running row as `RESOURCE_IMPORT_PROGRESS` messages arrive for its jobId: `processed / total` entries + determinate bar once `total` is known (REQ-2)
  5. system marks each finished row with its own outcome and inserts the new resource into the section list
- Alt flow: actor drops more files while jobs run → new rows appear and queue behind the bounds (REQ-4 keeps dropzone enabled).
- Exception: job errors → only that row shows the error (file name + message); siblings unaffected. Client-side pre-validation at enqueue (`file.size` ≤ 500MB, extension allow-list — free, before any upload) flips the row straight to error; failures discovered only SW-side (corrupt content) surface after upload on the same row.
- Rules:
  - A job row belongs to exactly one file and one section; rows keyed by the minted job id, never by index.
  - Per-completion refresh is a **soft refresh** — it must not toggle the `loading` flag (no skeleton flash); `loading` is initial-mount only.
  - On panel unmount: jobs that finished uploading continue in the SW; a mid-upload job is abandoned (its partial `pendingImports` entry is reaped by the existing 10-min TTL); queued jobs die with the panel. On remount, resources with `installationFinished=false` still render their existing "đang thêm…" card state — per-job progress rows are not restored.
  - The showcase/mock `RESOURCE_IMPORT_CHUNK` path must emit the same per-job progress phases (created/progress/done) so the showcase exercises identical UI states.
- Postcondition: every dropped file reaches exactly one terminal outcome (done / error / skipped) on its own row; a parked duplicate prompt is a non-terminal parked state (REQ-5).
- NFR refs: NFR-1, NFR-3, NFR-4

REQ-2: Real entry totals in progress
- Actor: User
- Goal: Progress denominator equals the file's true attempted-entry count
- Preconditions: an import job is running
- Basic flow:
  1. system (strategy) determines the entry total for its format
  2. system emits `onProgress(processed, total)` where `total` is exact; `RESOURCE_IMPORT_PROGRESS.payload.total` (schema field already exists) carries it end-to-end
  3. system (panel) renders `processed / total` ("34,021 / 73,643 mục") and a determinate progress bar
- Alt flow: before `total` is known (still decoding/counting) the row shows an indeterminate indicator with `processed` only — never a fabricated denominator (the `/100` hardcode is removed).
- Exception: a format that cannot produce a total → row stays indeterminate with a live processed count. For the enumerated formats below this path is defensive-only (all can produce exact totals).
- Rules — total-reporting contract per format (denominator = attempted entries):
  - `txt` (incl. gz/zip-wrapped): count of non-empty lines after decode — known before first insert.
  - `json-entries`, `wordlist-json`: length of the materialized parsed array/`list` — emitted immediately after parse, before first insert.
  - `json-array` (frequency, regex-streams strings — no materialized array): count pass = count of regex matches over the decoded text using the same string-matching rule; emitted before first insert.
  - `sqlite`: `SELECT COUNT(*)` on the table the parse path actually selects from — `langResourceEntry` for dictionaries; `langFrequencyEntry` with the existing `entries` fallback for frequency — emitted after DB open, before first insert.
  - `term-bank`: count pass over the relevant bank files applying the mode filter — DICTIONARY: all rows in `term_bank_*.json`; FREQUENCY: only `type==='freq'` rows in `term_meta_bank_*.json`. The count pass parses each bank for its length and releases it (peak memory must not add retained arrays beyond today's all-banks-decompressed baseline — `unzipAll` already inflates every bank). Double-parse CPU cost accepted per the exact-count decision.
- Postcondition: displayed denominator equals the number of entries the strategy will attempt to insert; final stored `wordCount` may be lower when entries are filtered — the success message reports `wordCount`.
- NFR refs: NFR-2

REQ-3: Overlapped import under bounded concurrency
- Actor: User
- Goal: A multi-file batch completes materially sooner than the sequential baseline via bounded overlap (upload of the next file + IDB-write waits of the current job overlap; sync SW work — `base64ToBytes`, `JSON.parse`, `gunzipFile`, `unzipAll` — still serializes on the single SW thread)
- Preconditions: ≥2 jobs queued
- Basic flow:
  1. system runs jobs from a single global FIFO queue (drop order across both sections)
  2. a queued job starts only when BOTH bounds allow: running jobs < `MAX_CONCURRENT_IMPORTS = 2` AND total in-flight file bytes < `MAX_INFLIGHT_BYTES ≈ 256MB`
  3. each running job streams its own base64 chunks sequentially under its own jobId; background `pendingImports` (already jobId-keyed) isolates jobs
- Alt flow: files dropped into both sections share the same queue and bounds.
- Exception: SW-side failure of one job (parse/IDB/quota) rejects only that job's promise → REQ-1 error path; other jobs continue. A job parked on a duplicate prompt keeps its slot — queued jobs still start while a slot remains free; if every slot is parked the queue waits for resolution (rows visibly show the pending prompts).
- Rules:
  - Peak-memory rationale (why the byte bound exists): per running job the SW holds ~1.33×fileSize of accumulated base64 chunks plus a transient decode spike (~join+atob+Uint8Array+File ≈ ~4×fileSize for a 160MB file ≈ ~700MB); the panel additionally holds ~1.33×fileSize of base64 per uploading job. Unbounded parallelism with ~160MB files can OOM the SW on the 1GB-RAM persona — the byte bound is the real guard; the job-count bound keeps contention sane for many small files.
  - At enqueue time the system dedupes by signature: a file whose signature matches another queued/running job's file is marked skipped-duplicate on its own row immediately, consuming no slot.
- Postcondition: measured wall time for the verification fixture meets NFR-3; no SW OOM.
- NFR refs: NFR-1, NFR-3

REQ-4: Non-blocking panel during import
- Actor: User
- Goal: Keep using the panel while imports run
- Preconditions: ≥1 job active
- Basic flow:
  1. system keeps both dropzones enabled while jobs run
  2. system keeps resource toggles, delete, reorder, expand, and the lookup field operable
  3. progress updates re-render only the affected job row
- Exception: none — all import work is async off the UI thread (the SW executes strategies; the panel only uploads chunks + renders pushes).
- Rules: no whole-panel `importing` gate; per-job state only.
- Postcondition: zero blocking states attributable to import.
- NFR refs: NFR-4

REQ-5: Per-job outcomes incl. duplicate resolution
- Actor: User
- Goal: Each file resolves independently — success count, error, or duplicate decision
- Preconditions: a job reaches completion or hits a signature duplicate
- Basic flow:
  1. system shows on the job's own row: success ("Đã thêm 73,643 từ"), or error text, or a duplicate prompt with Thay thế / Bỏ qua actions
  2. actor picks replace/skip on a duplicate prompt
  3. system resolves only that job (replace → continues the import on the same row; skip → row ends as skipped); siblings never see the prompt
- Alt flow: success rows auto-dismiss after ~4s (existing `SUCCESS_DISMISS_MS` pattern); error rows persist until a new drop or panel close; skipped rows keep a "Thay thế" affordance that re-runs the import as replace on the same row (parity with today's result-shaped-skip path).
- Exception: **replace must never target a still-importing resource** — if the existing resource has `installationFinished=false` the prompt offers only skip (replace affordance disabled with explanation); the background also rejects a `replace` decision against an unfinished resource (defense in depth against the enqueue→upload race).
- Rules: no section-level shared duplicate slot; prompts attach to their job; an unanswered prompt parks its job (and slot) without failing it — the queue keeps flowing through the other slot.
- Postcondition: `resources` list reflects each finished job (soft refresh per completion); every job has exactly one terminal state.
- NFR refs: NFR-4

REQ-6: Drag-handle reorder
- Actor: User
- Goal: Reprioritize a resource in one drag gesture
- Preconditions: section has ≥2 resources
- Basic flow:
  1. actor presses the grip handle (ICON_CATALOG `moveVertical`) at the row's left edge and drags vertically
  2. system moves the row live (pointer-based reorder within its section)
  3. actor releases → system persists the new order via `reorderResources` and confirms with a soft refresh
- Alt flow: keyboard/switch users — the existing up/down controls stay operable (a11y fallback; persona 5–80y).
- Exception: persist failure → refresh restores persisted order (existing pattern).
- Rules: reorder is per-section (never across DICTIONARY/FREQUENCY); optimistic order uses the existing `sortByPriority` contract.
- Postcondition: persisted `priority` order matches the visual order — survives panel remount and full reload.
- NFR refs: NFR-4, NFR-5

REQ-7: Integrated dictionary lookup beside resources
- Actor: User
- Goal: Type arbitrary text and see real results from all enabled dictionaries + frequency lists — to verify resources work
- Preconditions: Settings → Resources open
- Basic flow:
  1. system renders a lookup column to the right of the resource lists (stacks below on narrow layouts), hosting `Dictionary variant='integrated'` (search field + history + `CandidateView` results — same fidelity as the video popup per user decision)
  2. actor types/edits text in its search field
  3. system runs the real `LOOKUP_REQUEST` path (existing 500ms debounce) and renders results including frequency data from enabled frequency resources
- Alt flow: zero usable resources → the panel's existing empty state explains the situation.
- Exception: lookup failure → the panel's existing error Alert.
- Rules:
  - **Seam (build-gate binding):** `features/dictionary` must NOT import `features/dictionaryPopup` (would close a feature cycle — `KNOWN_CYCLES` is empty). Composition happens at the `settings` level: `SettingsDialogContent`'s Resources card lays out the two columns; `dictionaryPopup` gains an `index.ts` barrel exporting `Dictionary` (no new deep-import ratchet entries).
  - The per-resource "Thử tra từ" input + button inside `ResourceDetail` is removed (sample entries and the profile picker stay).
  - Card-creator actions: `onSendToCard`/`onQuickAdd` are omitted in this context — `CandidateView`/`useCandidate` must gate the send-to-card affordance on callback presence (quick-add is already prop-gated) so no dead button renders. Status-pill cycling persisting word status and search-history writes are acceptable (shared feature behavior).
  - `sourceLang` = the panel's `langCode`; `targetLang` = the configured native-language setting.
  - Lookup queries must exclude resources with `installationFinished=false` — a mid-import dictionary must not answer with partial data.
- Postcondition: editing the search text produces fresh cross-resource results; no per-resource lookup UI remains.
- NFR refs: NFR-4, NFR-6

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Concurrent imports must not OOM the SW on a 1GB-RAM device — peak accounting: ~1.33×fileSize base64 per job resident in SW `pendingImports` + ~4×fileSize transient decode spike per job + ~1.33×fileSize per uploading job in the panel | R/resource | dual bound: ≤2 running jobs AND <~256MB in-flight file bytes; verified on the 6 × ~160MB fixture |
| NFR-2 | Progress numbers must be truthful | U/R | denominator = exact attempted-entry count once known; never a placeholder |
| NFR-3 | Batch wall time vs sequential baseline on the verification fixture (6 × ~160MB normalized-JSON dictionaries, same machine) | P | ≥20% faster than sequential; if measurement lands below, cap stays and the delta is recorded as accepted in Open Questions |
| NFR-4 | UI stays interactive during import | U | no blocked controls; per-row renders; <3s feedback on every action (persona rule) |
| NFR-5 | Reorder accessible | U/a11y | keyboard-operable path retained alongside drag |
| NFR-6 | Lookup reflects resource state | F | disabled and `installationFinished=false` resources never answer queries |

## Flows / States

### Import job lifecycle (per job row)

```
queued --bounds allow--> uploading --chunks sent--> importing
importing: counting/parsing (indeterminate) --total known--> inserting (x/total)
inserting --done--> success (wordCount) --~4s--> dismissed
any pre-terminal --validation/parse/quota error--> error (persists)
any pre-terminal --signature dup--> duplicate-prompt --replace--> uploading
duplicate-prompt --skip--> skipped (keeps "Thay thế" re-run affordance)
enqueue --signature matches queued/running job--> skipped (no slot)
```

### Batch sequence (6 files, cap 2 + byte bound)

```
drop 6 files → jobs 1..6 queued (signature-deduped)
jobs 1,2 run → rows show progress
job reaches terminal → next queued job starts if byte bound allows
… all terminal → success rows auto-dismiss; errors persist
```

### Reorder

```
pointerdown on grip → drag (live visual reorder) → pointerup → reorderResources(orderedIds) → soft refresh
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Track per-file import lifecycle | Job state model + FIFO queue in `ResourcesPanel`; job-row list above each section's resource cards |
| Report exact entry progress | `onProgress(processed, total)` contract; per-format counting (line count / parsed-array length / regex count pass / COUNT(*) / filtered bank sum); `RESOURCE_IMPORT_PROGRESS.total` plumbing; showcase mock emitting the same phases |
| Overlap imports within memory budget | Dual bound (`MAX_CONCURRENT_IMPORTS=2`, `MAX_INFLIGHT_BYTES≈256MB`) scheduler; per-jobId chunk channel (existing) |
| Keep panel usable during import | Always-enabled dropzone; per-row state updates; soft refresh (no skeleton flash after initial load) |
| Surface per-file outcomes | Job-row terminal states: success auto-dismiss, error persist, inline duplicate replace/skip, skipped-row replace re-run; replace guard vs `installationFinished=false` |
| Reprioritize resources by gesture | Left-edge `moveVertical` grip + pointer-drag reorder; retained up/down buttons (a11y); `reorderResources` persist |
| Verify resources via real lookup | Right-column `Dictionary variant='integrated'` composed in `SettingsDialogContent` via new `dictionaryPopup/index.ts` barrel; callback-gated send-to-card; `installationFinished=false` exclusion in the lookup path |
| Preview resource contents | Existing `ResourceDetail` samples + profile picker (test-lookup removed) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| ImportJob (UI) | jobId, fileName, fileSize, signature, section type, status, processed, total, error, wordCount, duplicate{existing,resolve} | `ResourcesPanel` React state | Until row dismissed/unmount; uploaded jobs continue in SW if unmounted |
| ImportResult / progress payloads | jobId, phase, processed, total, resourceId | chrome messages | in-flight only |
| ResourceInfo.priority | persisted order | IDB resources store | permanent |
| Lookup input/results | term, candidates | `useDictionaryLookup` state + existing search-history storage | session + existing history retention |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 per-file items | REQ-1 | SC-1 |
| N2 real totals | REQ-2 | SC-2 |
| N3 parallel | REQ-3 | SC-3 |
| N4 non-blocking | REQ-4 | SC-4 |
| N5 per-file outcome | REQ-5 | SC-5, SC-6 |
| N6 drag reorder | REQ-6 | SC-7 |
| N7 integrated lookup | REQ-7 | SC-8 |
| N8 memory bound | REQ-3, NFR-1 | SC-3 |
| N9 exact total | REQ-2 | SC-2 |
| mock parity (Scope-In/DoD) | REQ-1 rules | SC-9 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1 six rows appear | REQ-1 |
| 2 real entry progress | REQ-2 |
| 3 parallel + live dropzone | REQ-3, REQ-4 |
| 4 isolated failure/dup | REQ-5 |
| 5 per-row outcome | REQ-5 |
| 6 drag grip reorder | REQ-6 |
| 7 lookup field beside lists | REQ-7 |

## Boundaries

- Always: reuse `ICON_CATALOG` (`moveVertical` grip), `shared/ui` components, existing `reorderResources`/`sortByPriority` contract, existing message channel; keep chunk-upload sequential per job; compose the lookup column at `settings` level via the new `dictionaryPopup` barrel — never `dictionary`→`dictionaryPopup`; Vietnamese copy consistent with existing panel strings.
- Ask first: new dependency; changes to `manifest.json`; touching files owned by other in-flight work beyond the dirty-tree approval already granted.
- Never: block the UI thread for counting (count inside the SW import path, not the panel); edit generated token files; commit hunks belonging to the foreign in-flight refactor.

## Success Criteria

- [ ] SC-1: Dropping N files renders N job rows in the correct section, each keyed to its file name, each showing its own status transitions (queued → uploading → importing → done/error/skipped; duplicate-prompt when applicable).
- [ ] SC-2: A running job row displays `processed / total` with `total` equal to the file's true attempted-entry count once known; no `/100` placeholder remains anywhere.
- [ ] SC-3: ≥2 jobs overlap during the 6 × ~160MB normalized-JSON fixture drop (interleaved progress observable); wall time meets NFR-3; no SW crash.
- [ ] SC-4: During active imports the dropzone accepts more files, toggles/delete/reorder/expand work, and the lookup field answers — nothing blocks.
- [ ] SC-5: A failing file marks only its own row with an error naming that file; siblings continue to their own outcomes.
- [ ] SC-6: A duplicate-signature file prompts replace/skip on its own row only; replace continues the same row (refused when the existing resource is still importing); skip ends it as skipped with a working "Thay thế" re-run.
- [ ] SC-7: A resource row can be dragged by its left-edge grip to a new position and the order persists across panel remount and reload; keyboard reorder still works.
- [ ] SC-8: The per-resource "Thử tra từ" UI is gone; the right-column search field returns live `CandidateView` results (incl. frequency info) drawn from enabled, finished resources as the text changes; no dead send-to-card button renders.
- [ ] SC-9: The design-system showcase renders job rows in queued/progress/done/error states from mocked progress messages.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green (incl. feature-cycle + deep-import checks)
- [ ] UI changes pass design-system check (tokens, `shared/ui`, `ICON_CATALOG`)
- [ ] Real-Chrome verification: drop ≥2 dictionaries → per-file progress rows with true totals, overlapped, panel interactive; drag reorder persists; integrated lookup returns results
- [ ] `docs/2-architechture-system.md` updated; showcase mock path mirrors new progress messages

## Open Questions / Accepted Risks

- `MAX_CONCURRENT_IMPORTS=2` + `MAX_INFLIGHT_BYTES≈256MB` are starting values — tune on the real-hardware measurement during DELIVER; if NFR-3's ≥20% isn't met under the bounds, record actual delta here.
- Term-bank count pass doubles bank-parse CPU (parse-for-length, release, re-parse during yield) — accepted per exact-count decision; retained-memory ceiling unchanged.
- Mid-upload panel close leaks a partial `pendingImports` entry (~1.33×fileSize) until the existing 10-min TTL reaps it — accepted; queued jobs dying with the panel is inherent (File objects live panel-side).
- MV3 SW termination mid-import — empirically OK today (imports already run SW-side); revisit only if real-Chrome verification shows kills.
- Lookup has no request timeout (`useDictionaryLookup` waits on the SW indefinitely) — pre-existing gap, not introduced by this item; recorded, not fixed here.
- `document.getElementById(SEARCH_INPUT_ID)` autofocus cannot cross the settings shadow root (dead autofocus — parity with DictionaryTab) and the fixed id could collide with a coexisting integrated panel — accepted for this item.
