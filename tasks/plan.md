# Implementation Plan: Popup Dictionary + English Phrase Matching

> Mode: no-yapping / caveman.
> One task = one outcome. One green checkpoint = one atomic commit.
> Scope: complete P0 from `docs/specs/spec-popup-dictionary.md` and close ADR-037.
> P1 stays after the P0 gate unless explicitly promoted.

## 0. Assumptions and hard boundaries

1. `docs/specs/spec-popup-dictionary.md` is the product source of truth.
2. `docs/adr/037-english-phrase-match.md` is the English phrase algorithm source of truth.
3. Existing dirty files unrelated to dictionary work are out of scope. Do not stage or revert them.
4. No new dependency. Reuse React, Zustand, Zod, IndexedDB, existing worker factory, shared UI, theme tokens, and Card Creator service.
5. No semantic-sense claim. UI says detected phrase / definition, never confidence or guaranteed sense.
6. P0 release path: imported dictionary → subtitle token → lookup → Popup Dictionary → definition → Quick Add to Anki.
7. P1 path: generic web-text trigger, Send to Creator workspace, full Card Creator restyle. It does not block P0.
8. No subagent is needed for planning. If one is used later: give one task only, no scope expansion, no yapping, return changed files, tests, blockers.

## 1. Current baseline

### Already implemented

- Cambridge template parser and AST validator.
- Fixture parser coverage for 34,094 multiword terms.
- Phrase index compiler, anchor postings, compact binary serialization.
- IndexedDB schema v10 and `langPhraseIndex` repository CRUD.
- Bounded token-DP matcher, lemma/possessive handling, deterministic ranking.
- Phrase service with word fallback and `AbortSignal`.
- Fixture compile/blob/match benchmark.

Last known commits:

- `16ed25e` parser + compiler + v10 phrase store
- `f98672a` bounded matcher + ranking
- `33bbdb3` phrase service + fallback + cancellation
- `baa21f6` benchmark

### Incomplete or wrong for production

| Gap | Severity | Evidence | Required result |
|---|---:|---|---|
| Compact blob loader + live worker anchor index absent | Blocker | ADR-037 implementation order #5 | Worker hydrates once, matches off UI thread, supports cancel |
| Cambridge import does not build/store phrase blob | Blocker | `importOrchestrator.ts` only runs strategy + finalizes resource | Import succeeds only after phrase blob succeeds; failure rolls back |
| Phrase service is not connected to real lookup transport/UI | Blocker | No `dictionaryPopup` module; no LOOKUP contract | Subtitle lookup reaches worker and Popup Dictionary |
| Service iterates phrase blobs without resource priority; `matchPhrase` returns `sourceResourceId: 0` | Major | current phrase service/matcher | Stable resource/source metadata and deterministic cross-resource result |
| Full P01–P33/N01–N20 gate is not covered | Major | current matcher suite covers only a subset | All ADR matrix cases pass; fixture strict test is generated |
| Language plugin interface, English plugin, Chinese plugin/FMM absent | Blocker | spec §4/§5 | EN + ZH P0 lookup works behind registry |
| Lookup request/result Zod schemas and MV3 worker envelope absent | Blocker | spec §9.2/§9.4 | Invalid boundary data rejected; cancel and requestId deterministic |
| Top-10k LRU/hydrate/miss path absent | Blocker | spec §2/§9.5 | No full dictionary dump; RAM budget holds |
| Word-status store absent | Major | spec §5.2/§9.2 | unknown → tracking → known → ignore persists |
| Settings schema v14 absent | Major | current settings schema is v13; spec §9.3 | Trigger/default tab/sticky size/SRS/auto-complete settings migrate safely |
| Subtitle token wrapping and trigger absent | Blocker | spec §5.2 | EN word spans + ZH segments trigger lookup with debounce |
| Popup Dictionary production UI absent | Blocker | spec §5.2/§4.6 | Responsive, accessible, Shadow DOM, lazy panels, error states |
| Audio/image/translate/link sources absent | Major | spec §5.2 | Lazy load with retry/fallback; do not block dictionary core |
| Quick Add integration absent | Blocker for P0 happy path | spec §4.6/§9.3.1 | One action sends selected/auto-completed fields to Anki |
| Browser and low-memory verification incomplete | Blocker for release | spec §10/ADR-037 §11 | Real browser, 320–1440px, dark/light, RAM/heap budgets |

## 2. Target architecture

```text
Subtitle token / click / hover
        │  requestId + contextSentence + cursorOffset
        ▼
Content trigger ──(debounce/cancel)──> lookup bridge
        │                                 │
        │                                 ├─ LOOKUP_RESULT
        ▼                                 ▼
Popup Dictionary <──── result assembler / lookup orchestrator
        │                  │
        │                  ├─ phrase index worker (AST + anchors only)
        │                  ├─ LRU top 10k definitions/frequency
        │                  └─ IndexedDB miss path
        │
        ├─ lazy audio/image/translate/links panels
        ├─ word status store
        └─ Quick Add → Card Creator settings → Anki service

Import:
file → Cambridge strategy → dictionary entries
     → lightweight phrase source collector → compile blob
     → putPhraseIndex → installationFinished=true
     → any failure: delete entries + blob + resource
```

### Worker decision

Use the existing `Worker`/`import.meta.url` factory pattern. The lookup worker owns the in-memory phrase index and the capped LRU. Background owns IndexedDB reads and sends transferred chunks. The content script does not put `LOOKUP` into the fan-out `MESSAGE_TYPES`; use the dedicated requestId bridge from spec §9.4. Prove this topology with a small round-trip test before building UI.

## 3. Ordered tasks

Each task is S or M. Do not combine unrelated tasks. Commit after each green task or after the stated checkpoint.

### Phase 0 — Contract first

#### Task 0.1 — Freeze baseline and reconcile docs

**Description:** Audit current source against spec/ADR. Mark stale ADR status and list current file ownership. Do not touch unrelated dirty files.

**Acceptance criteria:**
- [ ] Gap table above is verified by grep/read, not memory.
- [ ] No unrelated file is staged.
- [ ] ADR status says what is actually implemented, not what is planned.

**Verification:** `git status --short`; targeted grep; no code change.

**Dependencies:** None.

**Files likely touched:** `docs/adr/037-english-phrase-match.md`, `docs/2-architechture-system.md`.

**Commit:** `docs(dictionary): reconcile phrase implementation status`.

#### Task 0.2 — Define lookup contracts and boundary schemas

**Description:** Create the stable type boundary for `LookupRequest`, `LookupResult`, `PhraseMatchResult`, `WordStatus`, `WorkerMessage`, `WorkerResponse`, `QuickAddPayload`, and lazy-panel states. Add Zod validation at message/storage/network edges.

**Acceptance criteria:**
- [ ] Discriminated unions cover phrase, word, empty, error, cancelled.
- [ ] `contextSentence` and UTF-16 `cursorOffset` are required for phrase lookup.
- [ ] Invalid payloads fail closed with a machine-readable error.
- [ ] No `confidence` field is exposed.

**Verification:** colocated schema tests for valid/invalid payloads; typecheck.

**Dependencies:** Task 0.1.

**Files likely touched:** `src/features/dictionaryPopup/types.ts`, `src/features/dictionaryPopup/schema.ts`, `src/entities/dictionary/types.ts`, `src/entities/message/types.ts`, `src/shared/config/messages.ts`.

**Commit:** `feat(dictionary): define lookup and worker contracts`.

#### Task 0.3 — Prove worker topology and transferable transport

**Description:** Build the smallest worker round trip: `WORKER_READY`, `HYDRATE_CHUNK`, `HYDRATE_DONE`, `LOOKUP`, `LOOKUP_CANCEL`, `LOOKUP_RESULT`. Use the existing worker factory convention. Do not add UI.

**Acceptance criteria:**
- [ ] Worker starts in the supported extension context.
- [ ] ArrayBuffer transfer does not retain a second background reference.
- [ ] `requestId` routes responses; cancelled request produces no result.
- [ ] Worker restart/re-hydrate is safe.

**Verification:** worker unit test + build; manual startup smoke in Chrome/Edge.

**Dependencies:** Task 0.2.

**Files likely touched:** `src/features/dictionaryPopup/worker/lookupWorker.ts`, `src/features/dictionaryPopup/worker/workerFactory.ts`, `src/features/dictionaryPopup/worker/lookupWorker.test.ts`, `src/entrypoints/offscreen/lookupWorker.ts` if bundler entry is required.

**Commit:** `feat(dictionary): add lookup worker transport`.

### Checkpoint A — Contract

- [ ] Typecheck passes.
- [ ] Worker round trip passes in a real extension build.
- [ ] No UI work starts before this checkpoint is green.

### Phase 1 — Data plane and phrase runtime

#### Task 1.1 — Build phrase index during Cambridge import

**Description:** Add a lightweight Cambridge phrase-source collector. Compile only supported multiword templates. Store the blob before marking the resource finished. Keep definitions out of the blob.

**Acceptance criteria:**
- [ ] Cambridge import creates `langPhraseIndex` automatically.
- [ ] Non-Cambridge resources do not claim Cambridge phrase support.
- [ ] Unsupported/open terms are counted and excluded.
- [ ] Compiler error rolls back dictionary entries, phrase blob, and resource.
- [ ] Successful import sets `installationFinished=true` only after blob persistence.

**Verification:** import integration tests for success, unsupported terms, compiler failure rollback, duplicate import; fixture smoke.

**Dependencies:** Task 0.2, existing schema v10.

**Files likely touched:** `src/features/dictionary/logic/phraseIndexBuilder.ts`, `src/features/dictionary/strategies/baseImportStrategy.ts`, `src/features/dictionary/strategies/cambridgeJsonStrategy.ts`, `src/features/dictionary/logic/importOrchestrator.ts`, tests.

**Commit:** `feat(dictionary): build phrase index atomically during import`.

#### Task 1.2 — Add compact blob loader and worker anchor index

**Description:** Load and validate compiler-versioned blobs. Hydrate anchor postings into worker memory. Reject bad magic/version/length without crashing lookup.

**Acceptance criteria:**
- [ ] Loader validates magic, compilerVersion, termCount, anchor bounds.
- [ ] Worker keeps AST/index metadata only; no definitions/examples/media.
- [ ] Warm lookup uses anchor postings, never scans all terms.
- [ ] Resident blob/index budget is measured per resource.

**Verification:** malformed blob tests; loader round trip; warm lookup benchmark.

**Dependencies:** Task 0.3, Task 1.1.

**Files likely touched:** `src/features/dictionary/logic/phraseIndexCompiler.ts`, `src/features/dictionaryPopup/worker/phraseIndexLoader.ts`, worker tests, benchmark.

**Commit:** `feat(dictionary): load phrase blobs in lookup worker`.

#### Task 1.3 — Add top-10k LRU and definition miss path

**Description:** Hydrate top frequency entries only. On miss, background queries IndexedDB and pushes one entry to worker. Evict least-recently-used above 10k.

**Acceptance criteria:**
- [ ] Startup pre-hydrates top 10k, not full dictionary.
- [ ] LRU hard cap is exactly 10,000 live entries.
- [ ] Definition miss returns within target path and inserts into LRU.
- [ ] Eviction order is deterministic and tested.

**Verification:** 120k/100k synthetic benchmark; heap measurement; LRU unit tests.

**Dependencies:** Task 1.2.

**Files likely touched:** `src/features/dictionaryPopup/logic/lruCache.ts`, `src/features/dictionaryPopup/logic/lruCache.test.ts`, `src/features/dictionary/repositories/frequencyRepository.ts`, background lookup handler.

**Commit:** `feat(dictionary): add capped lookup LRU and miss hydration`.

#### Task 1.4 — Fix multi-resource priority and source identity

**Description:** Resolve phrase candidates across resources by explicit priority/import order. Return real `sourceResourceId`; do not rely on IndexedDB cursor order.

**Acceptance criteria:**
- [ ] Same phrase in two resources resolves by documented priority.
- [ ] Candidate/template IDs remain stable after serialization.
- [ ] `PhraseMatch.sourceResourceId` is never a sentinel zero for stored data.
- [ ] Definition lookup uses the winning resource when required.

**Verification:** two-resource integration tests; repeated runs produce same winner.

**Dependencies:** Task 1.2.

**Files likely touched:** `phraseMatcher.ts`, `phraseMatchService.ts`, resource repository/priority resolver, tests.

**Commit:** `fix(dictionary): make phrase resource ranking deterministic`.

#### Task 1.5 — Close the ADR P/N matrix and fixture strict gate

**Description:** Add missing P19–P33 and N04–N20 tests. Generate strict tests from fixture representatives. Fix matcher only when a failing case proves a real defect.

**Acceptance criteria:**
- [ ] P01–P33 pass.
- [ ] N01–N20 pass.
- [ ] Repeated-token cursor identity passes.
- [ ] Punctuation, word boundary, possessive, slot boundary, numeric slash, open-pattern cases pass.
- [ ] Fixture generation never throws and reports supported/unsupported counts.

**Verification:** `npx jest --selectProjects unit phraseMatcher`; fixture test; no arbitrary relaxed assertions.

**Dependencies:** Task 1.2.

**Files likely touched:** `phraseMatcher.test.ts`, `phraseTemplateParser.fixture.test.ts`, new generated strict fixture test, matcher/parser only when required.

**Commit:** `test(dictionary): close ADR-037 phrase matrix and fixture gate`.

### Checkpoint B — Phrase runtime

- [ ] Cambridge import creates a valid blob.
- [ ] Worker loads blob and answers/cancels lookup.
- [ ] 8MB/resource, 512KB transient state, warm p95 <100ms measured.
- [ ] P01–P33 and N01–N20 green.

### Phase 2 — Language plugins and lookup orchestration

#### Task 2.1 — Define plugin interface and English plugin

**Description:** Move language behavior behind the spec interface. English plugin owns tokenization, conservative lemma, possessive normalization, phrase matcher dispatch, reading kind, accent priority.

**Acceptance criteria:**
- [ ] `LanguagePlugin` contract is stable and testable.
- [ ] English plugin covers regular/irregular lemma, possessive, phrasal/idiom dispatch.
- [ ] Phrase matcher no longer hides a second incompatible lemma policy.
- [ ] Minimal fallback plugin exists for unsupported languages.

**Verification:** plugin unit tests; existing phrase tests remain green.

**Dependencies:** Task 0.2, Task 1.5.

**Files likely touched:** `src/features/dictionaryPopup/plugins/languagePlugin.ts`, `englishPlugin.ts`, `pluginRegistry.ts`, tests.

**Commit:** `feat(dictionary): add language plugin contract and English plugin`.

#### Task 2.2 — Add Chinese FMM plugin

**Description:** Implement dictionary-driven forward maximum matching, pinyin reading, and chengyu phrase hook. No external segmentation dependency.

**Acceptance criteria:**
- [ ] `我喜欢你` segments `我 / 喜欢 / 你` when dictionary contains `喜欢`.
- [ ] Longest valid dictionary term wins.
- [ ] Single-character fallback works.
- [ ] Ambiguity ceiling is documented; no DAG in MVP.

**Verification:** unit tests + synthetic 120k-entry benchmark.

**Dependencies:** Task 2.1, Task 1.3.

**Files likely touched:** `chinesePlugin.ts`, `matchStrategy.ts`, tests.

**Commit:** `feat(dictionary): add Chinese dictionary-driven segmentation`.

#### Task 2.3 — Build lookup orchestrator and result assembler

**Description:** Combine phrase → word fallback, reading, frequency, definitions, status, source, and plugin result into one `LookupResult`.

**Acceptance criteria:**
- [ ] Longest valid phrase wins before single-word fallback.
- [ ] No phrase result returns opaque confidence.
- [ ] Missing dictionary returns explicit empty state data.
- [ ] Definitions are rendered as safe text/data, not unsanitized HTML.

**Verification:** integration tests against IndexedDB + worker contract.

**Dependencies:** Task 1.3, Task 1.4, Task 2.1, Task 2.2.

**Files likely touched:** `lookupOrchestrator.ts`, `phraseMatchService.ts`, `priorityResolver.ts`, tests.

**Commit:** `feat(dictionary): assemble deterministic lookup results`.

#### Task 2.4 — Wire content/background lookup bridge

**Description:** Add subtitle token trigger, request debounce, request cancellation, tab scoping, and result relay. Keep lookup envelope separate from fan-out messages.

**Acceptance criteria:**
- [ ] Hover debounce 150ms; click debounce 50ms.
- [ ] Rapid requests cancel stale request by `requestId`.
- [ ] Background responses carry `tabId` when fan-out is used.
- [ ] No duplicate/flickering result under rapid hover.

**Verification:** content/background integration tests; real browser message smoke.

**Dependencies:** Task 0.3, Task 2.3.

**Files likely touched:** content lookup controller, background lookup handler, message types, bridge tests.

**Commit:** `feat(dictionary): wire subtitle lookup transport and cancellation`.

### Checkpoint C — End-to-end data

- [ ] EN subtitle token returns `LookupResult`.
- [ ] ZH click returns longest dictionary segment.
- [ ] Empty/miss/cancel paths are explicit.
- [ ] No full dictionary dump reaches worker.

### Phase 3 — Storage and settings

#### Task 3.1 — Add word-status store

**Description:** Persist `unknown`, `tracking`, `known`, `ignore`. Add the cycle operation. Decide schema increment and record key before coding; keep it separate from phrase blob.

**Acceptance criteria:**
- [ ] Status cycle is exactly unknown → tracking → known → ignore → unknown.
- [ ] Status survives reload and is keyed by language + canonical term.
- [ ] Quota failure returns a recoverable error; lookup still works.

**Verification:** IndexedDB CRUD/cycle/quota tests.

**Dependencies:** Task 0.2.

**Files likely touched:** `baseRepository.ts`, `wordStatusRepository.ts`, types, tests, ADR if schema decision is new.

**Commit:** `feat(dictionary): persist four-state word status`.

#### Task 3.2 — Add settings schema v14

**Description:** Add `DictionaryPopupSettings` and Card Creator auto-complete/audio fallback settings. Migrate v13 → v14. Default tab is global with optional per-language override.

**Acceptance criteria:**
- [ ] Existing settings survive migration.
- [ ] Defaults match spec: click, null tab, 560px width, 480px max height, Anki, safe language default.
- [ ] Values clamp to viewport/runtime limits.
- [ ] No hover-delay setting is exposed.

**Verification:** migration tests, settings round trip, invalid-value tests.

**Dependencies:** Task 0.2.

**Files likely touched:** `entities/settings/types.ts`, `shared/lib/storage/settingsStore.ts`, config defaults, settings tests.

**Commit:** `feat(settings): add dictionary popup settings v14`.

#### Task 3.3 — Add status/lookup/Quick Add message contracts

**Description:** Add only required MV3 message types: community audio, images, TTS, word status, Quick Add. Validate every boundary. Keep external URL templates encoded.

**Acceptance criteria:**
- [ ] `tabId` is present on fan-out responses.
- [ ] URL template fills use `encodeURIComponent`.
- [ ] Quick Add payload rejects unknown destination; MVP destination is Anki.
- [ ] Errors are structured and safe for UI display.

**Verification:** schema/message tests; lint/typecheck.

**Dependencies:** Task 0.2, Task 3.2.

**Files likely touched:** message types/constants, schemas, background handlers, tests.

**Commit:** `feat(dictionary): add popup side-effect message contracts`.

### Phase 4 — UI foundation and core popup

> UI rule: use the existing shared UI and design-system tokens. No raw color/radius/shadow. Flat surface, 1px hairline border, alpha hover/selected states, 2px focus ring offset 2px. Test dark/light at 320, 375, 768, 1024, 1440px. Icon-only controls need `aria-label`, keyboard access, and 40x40 touch target.

#### Task 4.1 — Add subtitle token spans and trigger affordance

**Description:** Wrap EN subtitle words and ZH segments without changing subtitle text semantics. Add hover/click/modifier behavior. Do not build popup yet; emit typed lookup requests.

**Acceptance criteria:**
- [ ] EN token spans preserve text and UTF-16 offsets.
- [ ] ZH spans use plugin segmentation.
- [ ] Trigger mode setting works.
- [ ] Scroll/play does not dismiss the future popup by accident.

**Verification:** DOM/controller unit tests; real subtitle browser smoke.

**Dependencies:** Task 2.4, Task 3.2.

**Files likely touched:** subtitle UI/controller, dictionary popup trigger module, tests.

**Commit:** `feat(dictionary): add subtitle token lookup triggers`.

#### Task 4.2 — Build PopupDictionary shell, positioner, and resize

**Description:** Mount popup in isolated Shadow DOM. Implement viewport-safe placement, resize handle, sticky size, outside/Esc dismiss, and focus entry. No external panels yet.

**Acceptance criteria:**
- [ ] Popup never overflows viewport at 320/375/768/1024/1440px.
- [ ] Placement tries left/right/top/bottom and clamps to viewport.
- [ ] Width/height persist and clamp on next open.
- [ ] Click inside, scroll, and video play do not dismiss; Esc/outside does.
- [ ] Loading, empty, miss, error, and result shells render.

**Verification:** React tests + Playwright position/resize/dismiss tests; screenshot dark/light.

**Dependencies:** Task 4.1, Task 3.2.

**Files likely touched:** `PopupDictionary.tsx`, position/resize logic, module CSS, tests.

**Commit:** `feat(dictionary-ui): add responsive popup shell and positioning`.

#### Task 4.3 — Build header, definitions, and footer status

**Description:** Put the core learning content first: target/surface, reading, frequency, status badge, definitions always visible, per-definition checkbox, footer cycle.

**Acceptance criteria:**
- [ ] Phrase surface and dictionary term are both clear.
- [ ] All definitions default selected per spec.
- [ ] Safe text rendering handles long/malformed source content.
- [ ] Status cycle persists and announces change.
- [ ] No close X; Quick Add owns the primary action slot.

**Verification:** component tests for result/empty/miss/status/checkbox; accessibility tree check.

**Dependencies:** Task 4.2, Task 3.1, Task 2.3.

**Files likely touched:** `PopupHeader.tsx`, `DefinitionsPanel.tsx`, `PopupFooter.tsx`, CSS/tests.

**Commit:** `feat(dictionary-ui): add popup core content and word status`.

#### Task 4.4 — Add toolbar and lazy audio/image panels

**Description:** Add SVG toolbar controls and lazy panel state. Audio uses community source then system TTS fallback. Images use horizontal strip with selection state.

**Acceptance criteria:**
- [ ] Definitions remain visible when tabs change.
- [ ] Fetch starts only when panel opens or configured default tab requires it.
- [ ] Loading/error/retry/unavailable/playing states are visible and accessible.
- [ ] Audio/image failure never blocks phrase/definition content.

**Verification:** component tests with controlled boundary results; browser lazy-network check.

**Dependencies:** Task 3.3, Task 4.3.

**Files likely touched:** `PopupToolbar.tsx`, `AudioPanel.tsx`, `ImagePanel.tsx`, source adapters, CSS/tests.

**Commit:** `feat(dictionary-ui): add lazy audio and image panels`.

#### Task 4.5 — Add translate and external-link panels

**Description:** Add lazy sentence translation, copy action, and encoded external dictionary links. Preserve panel state when toggled back.

**Acceptance criteria:**
- [ ] Translation fetch is lazy and cancellable.
- [ ] Copy button is keyboard accessible and gives one toast/ack.
- [ ] Link templates only open encoded, validated URLs.
- [ ] Network failure has retry and does not crash popup.

**Verification:** component tests; network/console browser check.

**Dependencies:** Task 3.3, Task 4.4.

**Files likely touched:** `TranslatePanel.tsx`, `LinksPanel.tsx`, source adapters, CSS/tests.

**Commit:** `feat(dictionary-ui): add lazy translation and external links`.

#### Task 4.6 — Add settings UI for trigger, tabs, size, language, and SRS

**Description:** Extend existing settings UI. Use shared `Tabs`, `Toggle`, `Select/SearchableSelect`, `Input`, `Button`. Do not add a custom component when shared UI covers it.

**Acceptance criteria:**
- [ ] User can set click/hover/modifier.
- [ ] User can set global default tab and per-language override.
- [ ] Width/max-height and translation target validate/clamp.
- [ ] SRS destination shows Anki only in MVP.
- [ ] Card Creator exposes six auto-complete toggles and audio fallback.

**Verification:** settings component + migration tests; keyboard and dark/light browser checks.

**Dependencies:** Task 3.2, Task 3.3.

**Files likely touched:** settings panel, Card Creator settings panel, CSS/tests.

**Commit:** `feat(dictionary-ui): add popup and Quick Add settings`.

### Checkpoint D — UI core

- [ ] Popup core works with a fake/local `LookupResult`.
- [ ] Responsive breakpoints pass.
- [ ] Dark/light token audit has zero missing tokens.
- [ ] Accessibility: focus, labels, keyboard, contrast, no color-only state.

### Phase 5 — Quick Add and P0 integrations

#### Task 5.1 — Implement Quick Add payload assembly

**Description:** Build selection-aware payload. Toggle ON uses best-match auto-complete; toggle OFF uses only user-selected items. Respect field routing `None` separately.

**Acceptance criteria:**
- [ ] One Quick Add action sends valid `QuickAddPayload`.
- [ ] Definition/audio/image/translation/sentence selection behavior matches spec.
- [ ] Community audio fallback strategy is applied.
- [ ] No partially invalid card is sent.

**Verification:** pure payload tests for all toggle/selection combinations.

**Dependencies:** Task 3.2, Task 3.3, Task 4.3–4.5.

**Files likely touched:** Quick Add logic, Card Creator service adapter, schema/tests.

**Commit:** `feat(dictionary): assemble selection-aware Quick Add payload`.

#### Task 5.2 — Wire Anki Quick Add and acknowledgement states

**Description:** Connect payload to existing Card Creator/Anki service. Add success/error/offline/field-mapping failure toast and local retry payload.

**Acceptance criteria:**
- [ ] Success toast is announced and popup stays usable.
- [ ] Anki offline shows recovery action and preserves retryable payload locally.
- [ ] Missing deck/note field blocks send and identifies field safely.
- [ ] No secret/API data is logged.

**Verification:** service integration tests with fake client; browser happy/failure flows.

**Dependencies:** Task 5.1.

**Files likely touched:** background Card Creator handler, Quick Add UI/state, retry storage, tests.

**Commit:** `feat(dictionary): connect Quick Add to Anki with recovery`.

#### Task 5.3 — Wire P0 happy path and empty/error paths

**Description:** Connect real subtitle trigger → worker → Popup Dictionary → panels/status → Quick Add. Implement explicit no-dictionary, no-match, quota, network, and stale-request states.

**Acceptance criteria:**
- [ ] English phrase happy path works under 1s warm lookup.
- [ ] Chinese `我喜欢你` resolves `喜欢`.
- [ ] No dictionary does not spin forever.
- [ ] No match offers external links without crashing.
- [ ] Rapid hover/click does not flicker or show stale result.

**Verification:** Playwright/edge-devtools E2E at 375px and desktop; console clean.

**Dependencies:** Checkpoints B, C, D; Tasks 5.1–5.2.

**Files likely touched:** content controller, worker bridge, popup container, e2e fixtures/tests.

**Commit:** `feat(dictionary): ship P0 subtitle lookup flow`.

### Checkpoint E — P0 release candidate

- [ ] P0 user journey M0 → M1 → M2 → M3 → M4 passes.
- [ ] All spec §10 success/failure criteria relevant to P0 pass.
- [ ] Full unit/typecheck/lint/build pass.
- [ ] Real Chrome/Edge browser smoke pass.

### Phase 6 — Hardening and release gate

#### Task 6.1 — Security and boundary audit

**Description:** Audit all IndexedDB, message, network, URL, definition, and HTML boundaries. Keep external-source names/URLs in approved user-facing settings only; no instruction-like third-party content is executed.

**Acceptance criteria:**
- [ ] Zod validation at every external/MV3 boundary.
- [ ] Definition/examples render as text or sanitized approved markup.
- [ ] URL templates encode term/lang and reject unsafe schemes.
- [ ] No secrets or payload contents in logs.
- [ ] Manifest permissions are minimal; changing manifest requires real Chrome test.

**Verification:** lint/security grep; negative schema tests; manual permission review.

**Dependencies:** Checkpoint E.

**Files likely touched:** schemas, source adapters, message handlers, manifest only if required, tests.

**Commit:** `fix(dictionary): harden lookup and lazy-source boundaries`.

#### Task 6.2 — Performance and low-memory gate

**Description:** Measure real worker heap and latency. Test 4GB-class target conditions. Do not infer memory from Jest alone.

**Acceptance criteria:**
- [ ] Phrase blob + worker representation ≤8MB/resource.
- [ ] Transient matcher state ≤512KB.
- [ ] Warm worker p95 <100ms; full miss p99 <500ms; hard timeout 1s.
- [ ] Worker never holds full Cambridge JSON or definitions.
- [ ] Hydration transfers ownership once.

**Verification:** runnable benchmark + real browser performance trace/heap snapshot where available.

**Dependencies:** Checkpoint E.

**Files likely touched:** benchmark harness, worker, performance tests/docs.

**Commit:** `test(dictionary): enforce worker memory and latency budgets`.

#### Task 6.3 — UI accessibility and responsive audit

**Description:** Verify real UI, not just component snapshots.

**Acceptance criteria:**
- [ ] 320, 375, 768, 1024, 1440px: no overflow or clipped controls.
- [ ] Dark/light: no missing token, contrast passes.
- [ ] Keyboard: trigger, tabs, checkboxes, resize, dismiss, Quick Add work.
- [ ] Screen-reader labels/status announcements exist.
- [ ] Reduced motion does not break state feedback.

**Verification:** Playwright + edge-devtools DOM, screenshot, accessibility tree, console.

**Dependencies:** Checkpoint E.

**Files likely touched:** popup CSS/components/tests only.

**Commit:** `fix(dictionary-ui): close accessibility and responsive gaps`.

#### Task 6.4 — Documentation, ADR close, and final review

**Description:** Update architecture map, wiki index, spec status, ADR implementation order/decision gate, glossary, and final test report. Review all commits.

**Acceptance criteria:**
- [ ] ADR-037 status and implementation order reflect reality.
- [ ] Architecture map lists every new source file and dependency.
- [ ] Spec success criteria links to passing tests/browser evidence.
- [ ] No stale proposed path says implemented when absent.
- [ ] `git diff main...HEAD` reviewed; unrelated dirty files excluded.

**Verification:** docs grep; full test/build/lint/typecheck; code review checklist.

**Dependencies:** Tasks 6.1–6.3.

**Commit:** `docs(dictionary): close ADR-037 and popup dictionary release gate`.

## 4. P1 backlog — after P0 is green

These are specified but explicitly P1 in spec §4.6/§5.3. Do not mix them into P0 commits.

### Task P1.1 — Generic web-text lookup

- Selection/hover text outside subtitle overlay.
- DOM sentence extraction, same UTF-16/cursor contract.
- Outside-popup dismiss and modifier behavior remain consistent.
- E2E on representative web pages; no page CSS leakage.

### Task P1.2 — Send to Creator workspace

- Open/pre-fill two-pane Card Creator.
- Preserve lookup result and selected materials.
- Reuse existing Card Creator logic; no duplicate card model.

### Task P1.3 — Card Creator restyle

- Apply the 13 design principles after Popup Dictionary is stable.
- Header/settings/close, card type/deck, preview, field/media cards, footer actions.
- Separate commits from popup behavior changes.

## 5. Commit map

1. `docs(dictionary): reconcile phrase implementation status`
2. `feat(dictionary): define lookup and worker contracts`
3. `feat(dictionary): add lookup worker transport`
4. `feat(dictionary): build phrase index atomically during import`
5. `feat(dictionary): load phrase blobs in lookup worker`
6. `feat(dictionary): add capped lookup LRU and miss hydration`
7. `fix(dictionary): make phrase resource ranking deterministic`
8. `test(dictionary): close ADR-037 phrase matrix and fixture gate`
9. `feat(dictionary): add language plugin contract and English plugin`
10. `feat(dictionary): add Chinese dictionary-driven segmentation`
11. `feat(dictionary): assemble deterministic lookup results`
12. `feat(dictionary): wire subtitle lookup transport and cancellation`
13. `feat(dictionary): persist four-state word status`
14. `feat(settings): add dictionary popup settings v14`
15. `feat(dictionary): add popup side-effect message contracts`
16. `feat(dictionary-ui): add subtitle token lookup triggers`
17. `feat(dictionary-ui): add responsive popup shell and positioning`
18. `feat(dictionary-ui): add popup core content and word status`
19. `feat(dictionary-ui): add lazy audio and image panels`
20. `feat(dictionary-ui): add lazy translation and external links`
21. `feat(dictionary-ui): add popup and Quick Add settings`
22. `feat(dictionary): assemble selection-aware Quick Add payload`
23. `feat(dictionary): connect Quick Add to Anki with recovery`
24. `feat(dictionary): ship P0 subtitle lookup flow`
25. `fix(dictionary): harden lookup and lazy-source boundaries`
26. `test(dictionary): enforce worker memory and latency budgets`
27. `fix(dictionary-ui): close accessibility and responsive gaps`
28. `docs(dictionary): close ADR-037 and popup dictionary release gate`

No squash. Each commit must be independently buildable and revertable.

## 6. Definition of Done

- [ ] P0 happy path works offline from imported dictionaries.
- [ ] P01–P33 and N01–N20 pass.
- [ ] Cambridge import atomically creates phrase index.
- [ ] Worker loader, anchor index, LRU, miss path, and cancellation work.
- [ ] EN + ZH plugins work; minimal fallback works.
- [ ] Popup UI works in Shadow DOM, dark/light, 320–1440px.
- [ ] Definitions always visible; panels lazy; status persists; Quick Add works.
- [ ] No confidence score or semantic-sense claim.
- [ ] `npm run test:unit` pass.
- [ ] `npx tsc --noEmit` pass.
- [ ] `npm run lint` pass.
- [ ] `npm run build` pass.
- [ ] Browser smoke/E2E pass in Chrome/Edge.
- [ ] Low-memory and latency budgets pass.
- [ ] Docs/ADR/architecture map updated.
- [ ] Only intended files are committed.
