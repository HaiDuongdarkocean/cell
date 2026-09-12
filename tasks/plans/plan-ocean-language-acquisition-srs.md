# Implementation Plan: Ocean Language Acquisition SRS

## Overview

Build **Ocean Language Acquisition SRS** — a Chrome extension MV3, offline-first spaced-repetition feature for the Cell extension. Each *Learning Object* (word/phrase) is split into three independent memory components (**Meaning, Sound, Spelling**) with per-component FSRS state, progress, and scheduling. The system schedules the component most in need of reinforcement, renders a minimal *Front* stimulus (text / audio / image / typed input), reveals a full *Back* verification surface, and records a binary *Forget/Remember* judgment. V1 supports English, reuses the existing Card Creator for note creation, and adds a new `srs-study` extension entrypoint.

The work is sliced into 11 phases with 36 tasks. Each task is sized **M** (≤5 files) or smaller, with explicit acceptance criteria, verification steps, and dependencies so subagents can execute them in parallel and in order.

## Architecture Decisions

1. **Note vs Card split.** `SrsNote` holds immutable content; `SrsCard` holds the mutable 3-component state. A note can be re-added to a different deck as a new card, and resetting a card does not delete its note.
2. **Three independent memory components.** `meaning`, `sound`, `spelling` each have their own `progress`, `exploreCount`, `fsrsState`, and `reviewCount`. `Card.nextDue` is the minimum of all effective due dates.
3. **FSRS boundary.** Vendors `ts-fsrs@5.4.1` behind a project-owned `SrsFsrsAdapter` interface. `SrsFsrsSerializedState` is opaque; only the adapter reads `due`/`state`. If the T0 spike shows bundle/compat issues, fall back to a minimal vendored port.
4. **Storage isolation.** SRS data lives in a dedicated IndexedDB named `cell-srs-{hash}`, modeled after `src/features/dictionary/repositories/baseRepository.ts`, with compound index `by_deck_due` for O(1) bounded scheduling scans.
5. **Single data-owning entrypoint.** The `srs-study` page is the only context that opens and writes to the SRS IndexedDB. Other extension contexts (dictionary popup, Card Creator, background) communicate via typed MV3 messages.
6. **Card Creator reuse.** Add `'ocean-srs'` to `DictionaryPopupSettings.srsDestination` and open the existing Card Creator with an SRS prefill path; Card Creator emits `SRS_ADD_NOTE` to create `Note + Card`.
7. **Zod at boundaries.** Every message payload and IndexedDB write is validated. Domain logic uses TypeScript; no `any`.
8. **Progress ≠ FSRS retrievability.** Acquisition progress is a separate 0–100 score with configurable gain/penalty constants; FSRS owns difficulty/stability/due.
9. **Offline-first media.** Audio/image assets are cached as `ArrayBuffer` in `srsAudioAssets` / `srsImageAssets` at note-creation time. Cache miss during review falls back to a non-audio / non-image template.
10. **CSS modules + shared/ui.** All new UI uses `src/shared/ui/*` components, CSS modules, and design tokens. No hardcoded styles.

## Dependency Graph (text form)

```
T0 spike: ts-fsrs bundle + SrsFsrsAdapter interface
    │
    ▼
Domain types + Zod schemas + shared helpers
    │
    ├──▶ SrsDatabase IndexedDB bootstrap
    │
    ├──▶ Settings v26→v27 migration
    │
    ▼
Repositories (collection / deck / studyConfig / notetype / note / card / assets / reviewEvents)
    │
    ├──▶ Default notetype seed + first-run bootstrap
    │
    ├──▶ Audio / image asset cache service + LRU / quota
    │       │
    │       ▼
    │   Audio / image stimulus resolvers + blob URL lifecycle
    │
    ├──▶ FSRS adapter implementation
    │       │
    │       ▼
    │   Progress / learning path logic
    │       │
    │       ├──▶ Review engine (applyReview, studyAgain, reset)
    │       │
    │       ├──▶ resolvePool + pickHighestPriority
    │       │
    │       ├──▶ selectNextReview (by_deck_due cursor)
    │       │
    │       └──▶ resolveReviewSurface + maskSentence
    │
    ▼
Entrypoint / session / dashboard / management UI
    │
    ├──▶ Review front / back / controls
    │
    ├──▶ Spelling input + auto-advance
    │
    ▼
Cross-context add (message bus / background handlers / Card Creator / dictionary popup)
    │
    ▼
E2E + pre-commit gate + docs
```

## Task List

### Phase 0: T0 & Domain Foundation

#### Task 1: T0 spike — `ts-fsrs` bundle compat + adapter interface

**Description:** Pin and install `ts-fsrs@5.4.1`, verify it bundles in Vite and runs in a browser/offscreen context, and commit the project-owned `SrsFsrsAdapter` interface plus a skeleton `srsFsrsAdapter.ts`. If bundle/compat fails, document the fallback to a vendored minimal port.

**parallel:** false

**dependencies:** none

**Acceptance criteria:**
- [ ] `npm install` with pinned `ts-fsrs` succeeds and `package.json`/`package-lock.json` are updated.
- [ ] A temporary spike file can call `createEmpty` / `next` and the output shape matches `SrsFsrsSerializedState`.
- [ ] `SrsFsrsAdapter` interface is committed in `src/entities/srs/types.ts`.
- [ ] `src/features/srs/services/srsFsrsAdapter.ts` compiles (skeleton OK).

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- srsFsrsAdapter` spike test passes (or vendored fallback documented).
- [ ] `npm run build` succeeds.

**Files likely touched:**
- `package.json`
- `src/entities/srs/types.ts` (adapter interface)
- `src/features/srs/services/srsFsrsAdapter.ts`
- `src/features/srs/services/srsFsrsAdapter.test.ts`

**Estimated scope:** M

---

#### Task 2: Domain types, Zod schemas, and shared helpers

**Description:** Define all SRS domain types (`SrsCollection`, `SrsDeck`, `SrsStudyConfig`, `SrsNotetype`, `SrsNote`, `SrsCard`, `SrsMemoryComponent`, `SrsReviewRecord`, etc.) and persistence/message Zod schemas. Add shared helpers (`normalizeSpelling`, `minISO`, `maskSentence` helper, `escapeRegExp`, asset id hashing).

**parallel:** false

**dependencies:** [Task 1]

**Acceptance criteria:**
- [ ] `src/entities/srs/types.ts` contains the full V1 domain model and `SrsFsrsAdapter`.
- [ ] `src/entities/srs/schemas.ts` validates at least note/card payloads and message payloads.
- [ ] `src/features/srs/lib/helpers.ts` exports `normalizeSpelling`, `minISO`, `escapeRegExp`, `audioAssetId`, `imageAssetId`.
- [ ] Helpers unit tests pass.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- helpers` passes.

**Files likely touched:**
- `src/entities/srs/types.ts`
- `src/entities/srs/schemas.ts`
- `src/features/srs/lib/helpers.ts`
- `src/features/srs/lib/helpers.test.ts`

**Estimated scope:** M

---

#### Task 3: `SrsDatabase` IndexedDB bootstrap

**Description:** Create the new `cell-srs-{hash}` IndexedDB wrapper following `baseRepository` pattern. Define object stores `collections`, `decks`, `studyConfigs`, `notetypes`, `notes`, `cards`, `audioAssets`, `imageAssets`, `reviewEvents` with the indexes listed in the spec, and expose `getDB`, `closeDB`, `deleteDB`, and test helpers.

**parallel:** true

**dependencies:** [Task 2]

**Acceptance criteria:**
- [ ] `src/features/srs/repositories/srsDatabase.ts` opens DB version 1 and creates all stores/indexes.
- [ ] `getDB`, `closeDB`, `closeAllDBs`, `deleteDB`, `clearAllStores` are exported.
- [ ] `srsDatabase.test.ts` opens a test DB and asserts each store/index exists.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- srsDatabase` passes.

**Files likely touched:**
- `src/features/srs/repositories/srsDatabase.ts`
- `src/features/srs/repositories/srsDatabase.test.ts`

**Estimated scope:** S

---

### Checkpoint 0: Foundation

- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes for `srsFsrsAdapter`, `helpers`, `srsDatabase`.
- [ ] Domain model and adapter interface are reviewable by a TL before repository work.

### Phase 1: Settings & Repository Skeleton

#### Task 4: Settings v26 → v27 migration + `SrsSettingsSlice`

**Description:** Add `SrsSettingsSlice` and `SrsDataLifecycleConfig` to `Settings`, update `DEFAULT_SETTINGS`, bump `CURRENT_SCHEMA_VERSION` to 27, and write the v26 → v27 migration.

**parallel:** true

**dependencies:** [Task 2]

**Acceptance criteria:**
- [ ] `Settings.srs` exists with `defaultStudyConfigId`, `activeCollectionId`, `activeDeckId`, `activeLanguageProfileId`, and `dataLifecycle`.
- [ ] `DEFAULT_SETTINGS` includes the new slice.
- [ ] Migration v26 → v27 adds the `srs` slice with defaults and stamps `schemaVersion: 27`.
- [ ] Existing settings load and migrate without error.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- settingsStore` (or existing settings tests) passes.
- [ ] Manual: set `chrome.storage.local` to a v26 object, call `loadSettings()`, verify `srs` is populated.

**Files likely touched:**
- `src/entities/settings/types.ts`
- `src/shared/config/config.ts`
- `src/shared/lib/storage/settingsStore.ts`

**Estimated scope:** M

---

#### Task 5: Collection / deck / study-config repositories

**Description:** Implement CRUD for `SrsCollection`, `SrsDeck`, and `SrsStudyConfig` against the SRS IndexedDB, with immutable returns and `SrsError` for not-found/invalid input.

**parallel:** true

**dependencies:** [Task 3]

**Acceptance criteria:**
- [ ] `src/features/srs/repositories/collectionRepository.ts` supports get/put/delete and `getCollectionByLanguageProfileId`.
- [ ] `src/features/srs/repositories/deckRepository.ts` supports get/put/delete, parent/child queries, and ordering.
- [ ] `src/features/srs/repositories/studyConfigRepository.ts` supports get/put/delete with defaults.
- [ ] `srsMetaRepositories.test.ts` covers CRUD and `SrsError` for all three.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- srsMetaRepositories` passes.

**Files likely touched:**
- `src/features/srs/repositories/collectionRepository.ts`
- `src/features/srs/repositories/deckRepository.ts`
- `src/features/srs/repositories/studyConfigRepository.ts`
- `src/features/srs/repositories/srsMetaRepositories.test.ts`

**Estimated scope:** M

---

#### Task 6: Notetype repository

**Description:** Implement `SrsNotetype` CRUD, including lookup by collection and by target field. Return immutable objects and throw `SrsError` for duplicates / missing records.

**parallel:** true

**dependencies:** [Task 3]

**Acceptance criteria:**
- [ ] `notetypeRepository.ts` supports get/put/delete/query by collection.
- [ ] Validates `targetFieldId` points to a `text` field before write (Zod / runtime check).
- [ ] `notetypeRepository.test.ts` covers CRUD and error cases.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- notetypeRepository` passes.

**Files likely touched:**
- `src/features/srs/repositories/notetypeRepository.ts`
- `src/features/srs/repositories/notetypeRepository.test.ts`

**Estimated scope:** S

---

#### Task 7: Note / card repositories

**Description:** Implement `SrsNote` and `SrsCard` CRUD, including `getNoteByTargetAndNotetype`, `getCardByNoteAndDeck`, and card lookups by `deckId` / `noteId`. Return immutable objects and throw `SrsError`.

**parallel:** true

**dependencies:** [Task 3]

**Acceptance criteria:**
- [ ] `noteRepository.ts` supports get/put/delete and `getNoteByTargetAndNotetype`.
- [ ] `cardRepository.ts` supports get/put/delete and `getCardByNoteAndDeck` and `getCardsByDeck`.
- [ ] `noteCardRepository.test.ts` covers CRUD and duplicate-guard logic.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- noteCardRepository` passes.

**Files likely touched:**
- `src/features/srs/repositories/noteRepository.ts`
- `src/features/srs/repositories/cardRepository.ts`
- `src/features/srs/repositories/noteCardRepository.test.ts`

**Estimated scope:** M

---

### Checkpoint 1: Repository Skeleton

- [ ] `npm run typecheck` passes.
- [ ] All repository unit tests pass.
- [ ] Manual: open `cell-srs-{hash}` in DevTools, verify stores and indexes.

### Phase 2: Asset Repositories & Defaults

#### Task 8: Audio / image / review-event repositories + delete cascade

**Description:** Implement `srsAudioAssets`, `srsImageAssets`, and `srsReviewEvents` CRUD, including index `by_note` and by-timestamp lookups. Add a `deleteCascade.ts` helper that implements collection/deck/note/card delete cascades as specified.

**parallel:** true

**dependencies:** [Task 5, Task 6, Task 7]

**Acceptance criteria:**
- [ ] `audioAssetRepository.ts`, `imageAssetRepository.ts`, and `reviewEventRepository.ts` support get/put/delete and note-scoped queries.
- [ ] `deleteCascade.ts` removes children (decks → notes → cards → review events/assets, etc.) in correct order.
- [ ] `assetReviewRepository.test.ts` covers CRUD and cascade.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- assetReviewRepository` passes.
- [ ] Manual: create collection, deck, note, card, delete deck, verify all dependent rows removed.

**Files likely touched:**
- `src/features/srs/repositories/audioAssetRepository.ts`
- `src/features/srs/repositories/imageAssetRepository.ts`
- `src/features/srs/repositories/reviewEventRepository.ts`
- `src/features/srs/repositories/deleteCascade.ts`
- `src/features/srs/repositories/assetReviewRepository.test.ts`

**Estimated scope:** M

---

#### Task 9: Default notetype seed + first-run bootstrap

**Description:** Build `createDefaultNotetype(collectionId)` and a `firstRunService` that auto-creates the default collection, deck, notetype, and study config when the SRS study page is opened with no collection for the active language profile.

**parallel:** false

**dependencies:** [Task 4, Task 5, Task 6, Task 7]

**Acceptance criteria:**
- [ ] `src/features/srs/lib/defaultNotetype.ts` exports `createDefaultNotetype` with the 8 front templates and `showAll` back template.
- [ ] `firstRunService.ts` reads `Settings.srs.activeLanguageProfileId`, finds/creates the matching collection, and updates `Settings.srs.activeCollectionId`/`activeDeckId`/`activeNotetypeId`.
- [ ] `firstRunService.test.ts` covers first-run and existing-collection paths.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- firstRunService` passes.
- [ ] Manual: clear SRS storage, open `srs-study` page, confirm default collection/deck/notetype created.

**Files likely touched:**
- `src/features/srs/lib/defaultNotetype.ts`
- `src/features/srs/services/firstRunService.ts`
- `src/features/srs/services/firstRunService.test.ts`

**Estimated scope:** M

---

### Checkpoint 2: Defaults

- [ ] `npm run typecheck` passes.
- [ ] First-run service test passes.
- [ ] Manual: default collection/deck/notetype created on first run.

### Phase 3: Offline Media Cache

#### Task 10: Audio / image asset cache service + LRU / quota

**Description:** Build a service layer around the audio/image asset repositories that fetches bytes from `PronunciationAudioOrchestrator`/URLs, stores in IndexedDB, evicts LRU when `audioQuotaMb` / `imageQuotaMb` is exceeded, and updates `lastAccessed`. Return cached assets as `ArrayBuffer`.

**parallel:** true

**dependencies:** [Task 8]

**Acceptance criteria:**
- [ ] `src/features/srs/services/audioAssetCache.ts` fetches/prunes word/sentence audio.
- [ ] `src/features/srs/services/imageAssetCache.ts` stores data-URL/base64 images and rejects external image URLs.
- [ ] `src/features/srs/services/quotaManager.ts` enforces LRU eviction by `lastAccessed` and `size`.
- [ ] `assetCache.test.ts` covers hit, miss, LRU eviction, and external URL rejection.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- assetCache` passes.

**Files likely touched:**
- `src/features/srs/services/audioAssetCache.ts`
- `src/features/srs/services/imageAssetCache.ts`
- `src/features/srs/services/quotaManager.ts`
- `src/features/srs/services/assetCache.test.ts`

**Estimated scope:** M

---

#### Task 11: Audio / image stimulus resolvers + blob URL lifecycle

**Description:** Implement `audioStimulusResolver` and `imageStimulusResolver` that build `SrsAudioAsset` / `SrsImageAsset` at note creation, create/refresh blob URLs at review time, and revoke them at end of session. Provide a fallback to non-audio/non-image templates when media is unavailable.

**parallel:** true

**dependencies:** [Task 10]

**Acceptance criteria:**
- [ ] `audioStimulusResolver.ts` calls `PronunciationAudioOrchestrator.resolve` and caches `ArrayBuffer`.
- [ ] `imageStimulusResolver.ts` decodes data URLs / base64 and stores `ArrayBuffer`.
- [ ] Both resolvers expose `getCachedAsset` and `createBlobUrl` / `revokeBlobUrl`.
- [ ] `stimulusResolverService.test.ts` covers fallback behavior and blob URL lifecycle.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- stimulusResolverService` passes.

**Files likely touched:**
- `src/features/srs/services/audioStimulusResolver.ts`
- `src/features/srs/services/imageStimulusResolver.ts`
- `src/features/srs/services/stimulusResolverService.test.ts`

**Estimated scope:** M

---

### Checkpoint 3: Media Cache

- [ ] Audio/image cache tests pass.
- [ ] Manual: add a note with word audio, disable network, verify blob URL playback in a review session.

### Phase 4: Core Review Logic

#### Task 12: FSRS adapter implementation

**Description:** Complete `srsFsrsAdapter.ts` wrapping `ts-fsrs`: `createEmpty`, `next` with judgment mapping (`forget` → `Rating.Again`, `remember` → `Rating.Good`), `preserveDue` for study-again, `isDue`, `getDue`, and a migration path.

**parallel:** true

**dependencies:** [Task 1, Task 2]

**Acceptance criteria:**
- [ ] `srsFsrsAdapter.ts` fully implements `SrsFsrsAdapter`.
- [ ] `forget` → `Rating.Again`, `remember` → `Rating.Good`.
- [ ] `preserveDue === true` keeps `due` and only updates `reps` / `lastReview`.
- [ ] `srsFsrsAdapter.test.ts` covers create, next, preserveDue, and isDue.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- srsFsrsAdapter` passes.

**Files likely touched:**
- `src/features/srs/services/srsFsrsAdapter.ts`
- `src/features/srs/services/srsFsrsAdapter.test.ts`

**Estimated scope:** S

---

#### Task 13: Progress & learning path logic

**Description:** Implement `progressCalculator.ts` (gain, penalty, `calculateProgress`), `learningPath.ts` (`isLocked`, `selectNextExploreComponent`, `recalcCard`), and helpers. Cover explore mode, sequential/parallel modes, thresholds, and maintenance mode.

**parallel:** true

**dependencies:** [Task 2, Task 12]

**Acceptance criteria:**
- [ ] `progressCalculator.ts` matches the V1 progress formula.
- [ ] `learningPath.ts` implements `isLocked`, `selectNextExploreComponent`, `recalcCard`.
- [ ] `recalcCard` updates `nextDue`, `maintenanceMode`, and clears expired `studyAgainDue`.
- [ ] `learningPath.test.ts` and `progressCalculator.test.ts` pass.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- learningPath` and `npm run test:unit -- progressCalculator` pass.

**Files likely touched:**
- `src/features/srs/logic/progressCalculator.ts`
- `src/features/srs/logic/learningPath.ts`
- `src/features/srs/logic/progressCalculator.test.ts`
- `src/features/srs/logic/learningPath.test.ts`

**Estimated scope:** M

---

#### Task 14: Review engine — `applyReview`, `studyAgain`, `resetComponent`, `resetCard`

**Description:** Implement the pure `reviewEngine.ts` functions: `applyReview`, `studyAgain`, `resetComponent`, `resetCard`, `createCard`. All functions must call `recalcCard` before returning.

**parallel:** true

**dependencies:** [Task 12, Task 13]

**Acceptance criteria:**
- [ ] `applyReview` handles `explore`, `normal`, and `studyAgain` modes.
- [ ] Spelling correct only counts when `normalizeSpelling(typedInput) === normalizeSpelling(note.targetWord)`.
- [ ] `studyAgain` sets `studyAgainDue[type] = now` and `recalcCard`.
- [ ] `resetComponent` and `resetCard` reset progress/explore/fsrs/review count and `recalcCard`.
- [ ] `reviewEngine.test.ts` covers A3–A9, A16, A17, and explore mode.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- reviewEngine` passes.

**Files likely touched:**
- `src/features/srs/logic/reviewEngine.ts`
- `src/features/srs/logic/reviewEngine.test.ts`

**Estimated scope:** S

---

### Checkpoint 4: Core Review Logic

- [ ] `npm run test:unit` passes for FSRS adapter, progress/learning path, and review engine.
- [ ] Manual: unit test traceability to AC A3–A9 reviewed.

### Phase 5: Scheduler & Review Surface

#### Task 15: `resolvePool` + `pickHighestPriority`

**Description:** Implement pool classification per component (`explore`, `studyAgain`, `active`, `satisfied`, `maintenance`) and the bucketed O(n) priority picker. No sorting; use the explicit pool order and tie-breakers (effectiveDue, then lowest progress).

**parallel:** true

**dependencies:** [Task 12, Task 13]

**Acceptance criteria:**
- [ ] `resolvePool.ts` returns the correct pool for each component given `now` and `config`.
- [ ] Locked components return `null`.
- [ ] `pickHighestPriority.ts` returns the highest-pool, earliest-due, lowest-progress candidate.
- [ ] `resolvePool.test.ts` covers explore, active, maintenance, studyAgain, and sequential locks (A1, A2, A11, A13).

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- resolvePool` passes.

**Files likely touched:**
- `src/features/srs/logic/resolvePool.ts`
- `src/features/srs/logic/pickHighestPriority.ts`
- `src/features/srs/logic/resolvePool.test.ts`

**Estimated scope:** M

---

#### Task 16: `selectNextReview` with `by_deck_due` cursor

**Description:** Implement the scheduler query that scans the `by_deck_due` compound index in a bounded range, collects up to `maxScan` card IDs, then batch-fetches cards/notes/notetypes. No async fetches inside the IndexedDB cursor.

**parallel:** true

**dependencies:** [Task 5, Task 6, Task 7, Task 15]

**Acceptance criteria:**
- [ ] `selectNextReview` uses `IDBKeyRange.bound([deckId, ''], [deckId, now])`.
- [ ] Cursor phase is synchronous; batch fetch happens after the cursor closes.
- [ ] Deck scoping includes subdecks when `includeSubdecks` is true.
- [ ] `scheduler.test.ts` covers due query, explore pool, and empty result (A1, A2, A11, A15).

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- scheduler` passes.
- [ ] Manual: profile `selectNextReview` with 1000 cards in fake-indexeddb, assert ≤100ms.

**Files likely touched:**
- `src/features/srs/logic/scheduler.ts`
- `src/features/srs/logic/scheduler.test.ts`

**Estimated scope:** M

---

#### Task 17: `resolveReviewSurface` + `maskSentence` + stimulus builder

**Description:** Build the review surface resolver: given a `SrsNote`, `SrsNotetype`, and `ComponentType`, filter front templates by component, attempt to build a usable `SrsStimulus` (masking sentence when configured), and fall through templates until one works. Include `maskSentence` helper.

**parallel:** true

**dependencies:** [Task 2, Task 11]

**Acceptance criteria:**
- [ ] `stimulusResolver.ts` exports `resolveReviewSurface` and `buildStimulus`.
- [ ] `maskSentence.ts` masks exact target word matches (case-insensitive) with `░`.
- [ ] Audio/image templates require cache hit or fall through.
- [ ] `stimulusResolver.test.ts` covers meaning/sound/spelling surface selection and masking.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- stimulusResolver` passes.

**Files likely touched:**
- `src/features/srs/logic/stimulusResolver.ts`
- `src/features/srs/logic/maskSentence.ts`
- `src/features/srs/logic/stimulusResolver.test.ts`

**Estimated scope:** M

---

### Checkpoint 5: Scheduler

- [ ] `npm run test:unit` passes for `resolvePool`, `scheduler`, and `stimulusResolver`.
- [ ] Manual: no async fetches inside `by_deck_due` cursor; scheduler returns a review session for a seeded card.

### Phase 6: Study UI Shell

#### Task 18: `srs-study` entrypoint + build wiring

**Description:** Add the `srs-study` extension entrypoint (HTML + main + root App), register it in `vite.config.ts` and `public/manifest.json`, and add the new route to `web_accessible_resources`.

**parallel:** true

**dependencies:** none (may start early)

**Acceptance criteria:**
- [ ] `src/entrypoints/srs-study/index.html`, `main.tsx`, and `App.tsx` exist.
- [ ] `vite.config.ts` adds `srsStudy` to `rollupOptions.input`.
- [ ] `public/manifest.json` exposes the new HTML page.
- [ ] `npm run build` emits `dist/src/entrypoints/srs-study/index.html`.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` succeeds.
- [ ] Manual: open `chrome-extension://<id>/src/entrypoints/srs-study/index.html` and see a blank/shell page.

**Files likely touched:**
- `src/entrypoints/srs-study/index.html`
- `src/entrypoints/srs-study/main.tsx`
- `src/entrypoints/srs-study/App.tsx`
- `vite.config.ts`
- `public/manifest.json`

**Estimated scope:** M

---

#### Task 19: Study session provider + hooks

**Description:** Build `SrsStudyProvider` and hooks `useStudySession` / `useSrsDashboard` that expose the current `SrsReviewSession`, apply a review judgment, study again/reset, and advance to the next card. Keep UI state in React context or Zustand; repository calls stay in the entrypoint.

**parallel:** true

**dependencies:** [Task 9, Task 12, Task 14, Task 16, Task 18]

**Acceptance criteria:**
- [ ] `SrsStudyProvider.tsx` initializes first-run, loads active collection/deck, and exposes `session`, `applyJudgment`, `studyAgain`, `resetComponent`, `resetCard`, `nextReview`.
- [ ] `useStudySession.ts` returns the current session and study actions.
- [ ] `useSrsDashboard.ts` returns due counts, new count, and maintenance count.
- [ ] `useStudySession.test.tsx` covers apply review and next review with mocked scheduler.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- useStudySession` passes.
- [ ] Manual: open `srs-study` page, seed one card, click Study, see a review session.

**Files likely touched:**
- `src/entrypoints/srs-study/providers/SrsStudyProvider.tsx`
- `src/entrypoints/srs-study/hooks/useStudySession.ts`
- `src/entrypoints/srs-study/hooks/useSrsDashboard.ts`
- `src/entrypoints/srs-study/hooks/useStudySession.test.tsx`

**Estimated scope:** M

---

#### Task 20: Dashboard header + empty / first-run states

**Description:** Build the `SrsDashboard` page with a language profile selector, collection summary (due / new / maintenance / today reviewed), quick actions (Study, Add word, Manage), and empty/first-run onboarding.

**parallel:** true

**dependencies:** [Task 4, Task 9, Task 19]

**Acceptance criteria:**
- [ ] `SrsDashboard.tsx` renders summary numbers and quick actions.
- [ ] `LanguageProfileSelector.tsx` switches `Settings.srs.activeLanguageProfileId` and auto-creates collection if missing (A20).
- [ ] Empty state shows "No cards due." and onboarding hint.
- [ ] `SrsDashboard.test.tsx` covers summary and language switch.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- SrsDashboard` passes.
- [ ] Manual: open dashboard, switch language profile, verify collection reload.

**Files likely touched:**
- `src/entrypoints/srs-study/pages/SrsDashboard.tsx`
- `src/entrypoints/srs-study/components/LanguageProfileSelector.tsx`
- `src/entrypoints/srs-study/components/SrsHeader.tsx`
- `src/entrypoints/srs-study/pages/SrsDashboard.module.css`
- `src/entrypoints/srs-study/pages/SrsDashboard.test.tsx`

**Estimated scope:** M

---

### Checkpoint 6: Study UI Shell

- [ ] Dashboard renders with real due counts.
- [ ] Study session provider can start and advance a review.
- [ ] Build passes and the entrypoint is reachable.

### Phase 7: Management UI

#### Task 21: Deck manager UI

**Description:** Implement the deck management page: list decks/subdecks, create/rename/delete, move/reorder, and show card count per deck. Use `shared/ui` components and CSS modules.

**parallel:** true

**dependencies:** [Task 5, Task 19]

**Acceptance criteria:**
- [ ] `DeckManager.tsx` lists decks with hierarchy.
- [ ] `DeckList.tsx` and `DeckForm.tsx` support create/rename/delete and parent selection.
- [ ] `useDeckManager.ts` wraps repository calls and refreshes the list.
- [ ] `DeckManager.test.tsx` (or hook test) covers CRUD.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- DeckManager` passes.
- [ ] Manual: create a subdeck, rename it, delete, verify cards move/delete.

**Files likely touched:**
- `src/entrypoints/srs-study/pages/DeckManager.tsx`
- `src/entrypoints/srs-study/components/DeckList.tsx`
- `src/entrypoints/srs-study/components/DeckForm.tsx`
- `src/entrypoints/srs-study/hooks/useDeckManager.ts`
- `src/entrypoints/srs-study/pages/DeckManager.module.css`

**Estimated scope:** M

---

#### Task 22: Notetype manager UI

**Description:** Implement the notetype management page: list notetypes, create, edit fields and front/back templates. V1 supports the default notetype plus user-created notetypes with field reordering.

**parallel:** true

**dependencies:** [Task 6, Task 19]

**Acceptance criteria:**
- [ ] `NotetypeManager.tsx` lists notetypes per collection.
- [ ] `NotetypeList.tsx` and `NotetypeForm.tsx` edit name, fields (add/remove/reorder), and templates.
- [ ] `useNotetypeManager.ts` handles persistence.
- [ ] Field validation ensures one `text` target field exists.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- NotetypeManager` passes (or hook test).
- [ ] Manual: create a notetype, add a field, save, reopen.

**Files likely touched:**
- `src/entrypoints/srs-study/pages/NotetypeManager.tsx`
- `src/entrypoints/srs-study/components/NotetypeList.tsx`
- `src/entrypoints/srs-study/components/NotetypeForm.tsx`
- `src/entrypoints/srs-study/hooks/useNotetypeManager.ts`
- `src/entrypoints/srs-study/pages/NotetypeManager.module.css`

**Estimated scope:** M

---

#### Task 23: SRS settings UI

**Description:** Add the SRS settings panel inside the study page: threshold, learning path (stages, progression mode, min explores), and progress constants. Persist to `SrsStudyConfig`.

**parallel:** true

**dependencies:** [Task 5, Task 19]

**Acceptance criteria:**
- [ ] `SrsSettingsPanel.tsx` edits threshold, learning-path stages, progression mode, and progress constants.
- [ ] `useSrsSettings.ts` loads/saves the active study config.
- [ ] Validation clamps values to sensible ranges.
- [ ] `SrsSettingsPanel.test.tsx` covers update and persistence.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- SrsSettingsPanel` passes.
- [ ] Manual: change threshold, refresh, value persists.

**Files likely touched:**
- `src/entrypoints/srs-study/pages/SrsSettingsPanel.tsx`
- `src/entrypoints/srs-study/components/SrsSettingsForm.tsx`
- `src/entrypoints/srs-study/hooks/useSrsSettings.ts`
- `src/entrypoints/srs-study/pages/SrsSettingsPanel.module.css`
- `src/entrypoints/srs-study/pages/SrsSettingsPanel.test.tsx`

**Estimated scope:** M

---

### Checkpoint 7: Management

- [ ] Deck, notetype, and settings UIs can create/edit/persist data.
- [ ] All management tests pass.

### Phase 8: Review Card UI

#### Task 24: Review front shell + non-audio stimuli

**Description:** Build the `ReviewFront` component and non-audio stimulus renderers: text, definition, sentence, masked sentence, and image. Dispatch by `stimulusType` and apply `maskTarget` from the template.

**parallel:** true

**dependencies:** [Task 15, Task 19]

**Acceptance criteria:**
- [ ] `ReviewFront.tsx` renders one stimulus at a time based on `SrsReviewSession.stimulus`.
- [ ] `StimulusText.tsx` and `StimulusImage.tsx` render text and image fields.
- [ ] Masked sentence replaces the target word with `░`.
- [ ] `ReviewFront.test.tsx` covers each stimulus type.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- ReviewFront` passes.
- [ ] Manual: review a card, see image/definition/sentence front.

**Files likely touched:**
- `src/entrypoints/srs-study/components/ReviewFront.tsx`
- `src/entrypoints/srs-study/components/StimulusText.tsx`
- `src/entrypoints/srs-study/components/StimulusImage.tsx`
- `src/entrypoints/srs-study/components/ReviewFront.module.css`
- `src/entrypoints/srs-study/components/ReviewFront.test.tsx`

**Estimated scope:** M

---

#### Task 25: Audio stimulus playback

**Description:** Build the `StimulusAudio` component and `useAudioStimulus` hook to play word/sentence audio from the blob URL, handle play/pause/replay, and fall back to a non-audio template when the blob is missing.

**parallel:** true

**dependencies:** [Task 24, Task 11]

**Acceptance criteria:**
- [ ] `StimulusAudio.tsx` renders an audio player and play button.
- [ ] `useAudioStimulus.ts` manages `HTMLAudioElement`, play/pause, and cleanup.
- [ ] Audio autoplays on mount when configured.
- [ ] `StimulusAudio.test.tsx` covers play and cleanup.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- StimulusAudio` passes.
- [ ] Manual: review a Sound card, audio plays, pause/replay works.

**Files likely touched:**
- `src/entrypoints/srs-study/components/StimulusAudio.tsx`
- `src/entrypoints/srs-study/hooks/useAudioStimulus.ts`
- `src/entrypoints/srs-study/components/StimulusAudio.test.tsx`

**Estimated scope:** S

---

#### Task 26: Back surface renderer

**Description:** Build `ReviewBack` and `FieldRenderer` to display all `backTemplate.fieldIds` in order, including text, audio, image, list, and translation fields. Reveal happens on user action or spelling auto-submit.

**parallel:** true

**dependencies:** [Task 24]

**Acceptance criteria:**
- [ ] `ReviewBack.tsx` renders the full back surface with `showAll` behavior.
- [ ] `FieldRenderer.tsx` dispatches field `kind` to the correct display.
- [ ] Audio fields in Back use the same `useAudioStimulus` hook.
- [ ] `ReviewBack.test.tsx` covers back template rendering.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- ReviewBack` passes.
- [ ] Manual: click Show Back, see target/sentence/definition/audio/image.

**Files likely touched:**
- `src/entrypoints/srs-study/components/ReviewBack.tsx`
- `src/entrypoints/srs-study/components/FieldRenderer.tsx`
- `src/entrypoints/srs-study/components/ReviewBack.module.css`
- `src/entrypoints/srs-study/components/ReviewBack.test.tsx`

**Estimated scope:** M

---

#### Task 27: Progress bars + component status

**Description:** Build `ComponentProgress` / `ProgressBars` components that show `Sound`, `Meaning`, `Spelling` progress, status (locked/active/satisfied/maintenance), and a legend. Use design tokens.

**parallel:** true

**dependencies:** [Task 19]

**Acceptance criteria:**
- [ ] `ProgressBars.tsx` renders three bars with percentage and status badge.
- [ ] `ComponentProgress.tsx` shows progress 0–100, color by status.
- [ ] `ProgressBars.test.tsx` covers locked/active/satisfied/maintenance states.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- ProgressBars` passes.
- [ ] Manual: review a card, observe progress for the component being tested.

**Files likely touched:**
- `src/entrypoints/srs-study/components/ProgressBars.tsx`
- `src/entrypoints/srs-study/components/ComponentProgress.tsx`
- `src/entrypoints/srs-study/components/ProgressBars.module.css`
- `src/entrypoints/srs-study/components/ProgressBars.test.tsx`

**Estimated scope:** M

---

#### Task 28: Review controls — Forget / Remember, Study Again, Reset

**Description:** Build `ReviewControls` with Forget/Remember buttons, a Study Again button, and Reset Component / Reset Card actions with confirmation dialogs. Wire to `useStudySession`.

**parallel:** true

**dependencies:** [Task 19, Task 26, Task 27]

**Acceptance criteria:**
- [ ] `ReviewControls.tsx` renders Forget/Remember (Remember disabled until spelling correct).
- [ ] `Study Again` triggers `studyAgain` and immediately requeues the same component.
- [ ] Reset actions show confirmation dialogs and call `resetComponent` / `resetCard`.
- [ ] `ReviewControls.test.tsx` covers each action.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- ReviewControls` passes.
- [ ] Manual: click Forget, see Back; click Reset, confirm, see progress reset.

**Files likely touched:**
- `src/entrypoints/srs-study/components/ReviewControls.tsx`
- `src/entrypoints/srs-study/hooks/useReviewActions.ts`
- `src/entrypoints/srs-study/components/ReviewControls.module.css`
- `src/entrypoints/srs-study/components/ReviewControls.test.tsx`

**Estimated scope:** M

---

### Checkpoint 8: Review Card

- [ ] Review front, back, audio, progress, and controls render and wire to session state.
- [ ] Forget/Remember/Reset/Study Again behave correctly in E2E smoke.

### Phase 9: Spelling Input

#### Task 29: Spelling input + live validation + auto-submit

**Description:** Build the `SpellingInput` component and `useSpelling` hook. Compare normalized input to `note.targetWord` on every change, show "Try again" feedback, enable Remember when correct, and auto-submit after the configurable delay.

**parallel:** true

**dependencies:** [Task 2, Task 14, Task 24]

**Acceptance criteria:**
- [ ] `SpellingInput.tsx` renders an input and a "Try again"/correct indicator.
- [ ] `useSpelling.ts` normalizes input and compares with `note.targetWord`.
- [ ] Remember is disabled until input matches; when it matches, auto-submit after 800ms.
- [ ] `SpellingInput.test.tsx` covers correct/incorrect/fallback (A5, A6).

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- SpellingInput` passes.
- [ ] Manual: type wrong → red feedback; type correct → auto-submit and Back reveals.

**Files likely touched:**
- `src/entrypoints/srs-study/components/SpellingInput.tsx`
- `src/entrypoints/srs-study/hooks/useSpelling.ts`
- `src/entrypoints/srs-study/components/SpellingInput.module.css`
- `src/entrypoints/srs-study/components/SpellingInput.test.tsx`

**Estimated scope:** M

---

#### Task 30: Spelling auto-advance + reveal feedback

**Description:** Add the spelling success animation/badge and auto-advance to the next card after a short delay. Ensure the input is cleared and the next review starts without extra clicks.

**parallel:** true

**dependencies:** [Task 29]

**Acceptance criteria:**
- [ ] Correct spelling reveals Back immediately and shows a "Correct" badge.
- [ ] After the delay, `nextReview()` is called automatically.
- [ ] Incorrect input after a failed attempt re-enables feedback and disables Remember.
- [ ] `SpellingFeedback.test.tsx` covers auto-advance.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- SpellingFeedback` passes.
- [ ] Manual: spell a word correctly, observe Back + badge + next card.

**Files likely touched:**
- `src/entrypoints/srs-study/components/SpellingFeedback.tsx`
- `src/entrypoints/srs-study/hooks/useSpellingAutoAdvance.ts`
- `src/entrypoints/srs-study/components/SpellingFeedback.test.tsx`

**Estimated scope:** S

---

### Checkpoint 9: Spelling

- [ ] Spelling auto-submit, feedback, and auto-advance work end-to-end.
- [ ] AC A5 and A6 pass in tests.

### Phase 10: Cross-context Add

#### Task 31: MV3 message types + Zod schemas

**Description:** Add `SRS_ADD_NOTE`, `SRS_GET_DECKS_NOTETYPES`, `SRS_OPEN_STUDY_PAGE` to `MessageType` and typed payloads. Add Zod schemas in `src/features/srs/messageSchemas.ts` for validation at the MV3 boundary.

**parallel:** true

**dependencies:** [Task 2]

**Acceptance criteria:**
- [ ] `src/entities/message/types.ts` includes `SrsAddNotePayload`, `SrsGetDecksNotetypesPayload`, `SrsOpenStudyPageRequest`, and responses.
- [ ] `src/features/srs/messageSchemas.ts` validates all cross-context payloads.
- [ ] `messageSchemas.test.ts` covers valid/invalid payloads.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- messageSchemas` passes.

**Files likely touched:**
- `src/entities/message/types.ts`
- `src/features/srs/messageSchemas.ts`
- `src/features/srs/messageSchemas.test.ts`

**Estimated scope:** M

---

#### Task 32: Background SRS message handlers

**Description:** Add a background handler `src/entrypoints/background/handlers/srs.ts` that receives `SRS_ADD_NOTE`, `SRS_GET_DECKS_NOTETYPES`, and `SRS_OPEN_STUDY_PAGE`. It opens the `srs-study` tab and either proxies the payload to the entrypoint or returns collection/deck/notetype lists.

**parallel:** true

**dependencies:** [Task 31, Task 9, Task 16]

**Acceptance criteria:**
- [ ] Background handler opens or focuses the `srs-study` tab on `SRS_OPEN_STUDY_PAGE`.
- [ ] `SRS_GET_DECKS_NOTETYPES` returns collections + default deck/notetype for a target language.
- [ ] `SRS_ADD_NOTE` is forwarded to the `srs-study` entrypoint via a message broadcast or tab post.
- [ ] `srsHandler.test.ts` covers open + list payloads.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- srsHandler` passes.
- [ ] Manual: send `SRS_OPEN_STUDY_PAGE`, verify tab opens.

**Files likely touched:**
- `src/entrypoints/background/handlers/srs.ts`
- `src/entrypoints/background/index.ts` (register handler)
- `src/entrypoints/background/handlers/srs.test.ts`

**Estimated scope:** M

---

#### Task 33: Card Creator `'ocean-srs'` destination

**Description:** Extend `CardCreatorOpenContext` / `CardCreatorPrefill` with an `srsDestination` field, build an `srsAddNote` service that maps dictionary fields to `SrsFieldValue`, and update the Card Creator dialog to show the destination selector and collection/deck/notetype dropdowns when `srsDestination === 'ocean-srs'`.

**parallel:** true

**dependencies:** [Task 2, Task 31]

**Acceptance criteria:**
- [ ] `src/features/cardCreator/types.ts` includes `srsDestination` and `srsContext`.
- [ ] `src/features/cardCreator/service/srsAddNote.ts` builds `Record<string, SrsFieldValue>` from prefill + media.
- [ ] `CardCreatorDialog.tsx` / `useCardCreatorState.ts` show SRS selectors when destination is `'ocean-srs'`.
- [ ] Submitting sends `SRS_ADD_NOTE` and toasts success/error.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- srsAddNote` passes.
- [ ] Manual: open Card Creator from dictionary, select Ocean SRS, add a word, see it in the SRS deck.

**Files likely touched:**
- `src/features/cardCreator/types.ts`
- `src/features/cardCreator/service/srsAddNote.ts`
- `src/features/cardCreator/service/srsAddNote.test.ts`
- `src/features/cardCreator/ui/CardCreatorDialog.tsx` or `CardCreatorDialogContent.tsx`

**Estimated scope:** M

---

#### Task 34: Dictionary popup SRS destination selector + flow

**Description:** Update `DictionaryPopupSettings.srsDestination` to accept `'anki' | 'ocean-srs'`, add the selector in `DictionaryPopupSettingsPanel`, and wire the dictionary popup / universal panel to open Card Creator with SRS prefill when the user selects Ocean SRS.

**parallel:** true

**dependencies:** [Task 4, Task 33, Task 32]

**Acceptance criteria:**
- [ ] `src/entities/settings/types.ts` and `src/shared/config/config.ts` allow `srsDestination: 'anki' | 'ocean-srs'`.
- [ ] `DictionaryPopupSettingsPanel.tsx` exposes the destination dropdown.
- [ ] `CandidateView.tsx` / `DictionaryToolbar.tsx` / `webTextDictionaryController.ts` open Card Creator with `srsDestination: 'ocean-srs'` and prefill fields (A18, A19).
- [ ] When adding, `SRS_ADD_NOTE` is sent and the destination persists.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- CandidateView` (or settings test) passes.
- [ ] Manual: open dictionary, select Ocean SRS, add word, verify card appears in SRS study page.

**Files likely touched:**
- `src/entities/settings/types.ts`
- `src/shared/config/config.ts`
- `src/features/settings/ui/DictionaryPopupSettingsPanel.tsx`
- `src/features/dictionaryPopup/ui/CandidateView.tsx` or `DictionaryToolbar.tsx`
- `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`

**Estimated scope:** M

---

### Checkpoint 10: Cross-context Add

- [ ] `SRS_ADD_NOTE` creates a card from dictionary/Card Creator.
- [ ] `SRS_GET_DECKS_NOTETYPES` returns correct defaults for a language.
- [ ] Manual end-to-end: dictionary → Add to Ocean SRS → study page shows the word.

### Phase 11: Verify & Polish

#### Task 35: E2E browser test

**Description:** Add `e2e/ocean-srs.spec.ts` covering first-run, add word from dictionary, review Sound/Meaning/Spelling, switch language profile, and offline audio cache. Use Playwright / the existing `testing-extension-browser` skill.

**parallel:** false

**dependencies:** [Task 20, Task 24, Task 28, Task 30, Task 34]

**Acceptance criteria:**
- [ ] `e2e/ocean-srs.spec.ts` exists and runs.
- [ ] First-run auto-creates collection/deck/notetype.
- [ ] Add from dictionary creates a card.
- [ ] Review Sound/Meaning/Spelling updates component progress.
- [ ] Offline mode (disable network) still reviews cached audio.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e -- ocean-srs` passes (or manual browser verify).

**Files likely touched:**
- `e2e/ocean-srs.spec.ts`
- `src/entrypoints/srs-study/App.tsx` (if E2E needs a11y/test ids)

**Estimated scope:** M

---

#### Task 36: Pre-commit gate + docs / ADR updates

**Description:** Run the full pre-commit gate, fix any lint/type/test/build failures, and update docs (intent, spec, architecture, ADRs). Document the FSRS adapter and notetype/template id decisions.

**parallel:** false

**dependencies:** [Task 35]

**Acceptance criteria:**
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, and `npm run build` all pass.
- [ ] `docs/intent/ocean-language-acquisition-srs.md` and `docs/specs/ocean-language-acquisition-srs.md` reflect final decisions.
- [ ] `docs/2-architechture-system.md` updated if architecture changed.
- [ ] ADR written for `SrsFsrsAdapter` / vendored-fallback and notetype id scheme.

**Verification:**
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] `design-system-guardian` if UI touched.

**Files likely touched:**
- `docs/intent/ocean-language-acquisition-srs.md`
- `docs/specs/ocean-language-acquisition-srs.md`
- `docs/2-architechture-system.md`
- `docs/ADRs/adr-srs-fsrs-adapter.md`

**Estimated scope:** M

---

### Checkpoint 11: Complete

- [ ] All quality gates pass.
- [ ] All AC A1–A20 traceable to tests.
- [ ] Docs and ADRs updated.
- [ ] PR ready for review.

## Parallelization Opportunities

### Safe to run in parallel (after their dependencies)

- **Repository work (Tasks 5, 6, 7):** Once `SrsDatabase` is ready, the three repository tasks touch distinct files (`collection/deck/studyConfig`, `notetype`, `note/card`) and can run in parallel.
- **Media cache (Tasks 10, 11):** Asset repository + cache service and the resolver/fallback layer are independent after repositories.
- **Core logic (Tasks 12, 13, 15):** FSRS adapter, progress/learning path, and pool resolution are pure functions in separate files and can run in parallel.
- **Scheduler + surface (Tasks 16, 17):** `selectNextReview` and `resolveReviewSurface` are independent after their respective dependencies.
- **UI shell / management (Tasks 18–23):** Entrypoint, session provider, dashboard, and management UIs are independent after `SrsStudyProvider` / session hooks contract.
- **Review card (Tasks 24–28):** Front, audio, back, progress, and controls can be built in parallel against the `ReviewSession` contract.
- **Spelling (Tasks 29–30):** Spelling input and auto-advance are sequential to each other but can run parallel with review card UI after the session contract is ready.
- **Cross-context (Tasks 31–34):** Message types, background handlers, Card Creator integration, and dictionary popup integration are independent after message schemas and repository contracts.

### Must be sequential

- **T0 spike (Task 1)** must finish before the domain types (Task 2) and FSRS adapter (Task 12).
- **Domain types (Task 2)** must finish before repositories, settings migration, and any logic.
- **SrsDatabase (Task 3)** must finish before all repository tasks.
- **Repositories (Tasks 5–8)** must finish before first-run (Task 9), scheduler (Task 16), and cross-context add (Task 32).
- **Progress/learning path (Task 13)** must finish before review engine (Task 14), `resolvePool` (Task 15), and `selectNextReview` (Task 16).
- **Review engine (Task 14)** must finish before session provider (Task 19), spelling input (Task 29), and Card Creator add (Task 33).
- **Scheduler/surface (Tasks 15–17)** must finish before session provider (Task 19) and review front (Task 24).
- **Session provider (Task 19)** must finish before dashboard, management UI, and review UI.
- **E2E (Task 35)** must run after all UI and cross-context work.

### Needs coordination

- **Repository tasks** must agree on `SrsDatabase` store/index names and `SrsError` codes; use `src/entities/srs/types.ts` and `srsDatabase.ts` as the shared contract.
- **UI tasks** must coordinate on the `SrsReviewSession` shape and the `useStudySession` / `SrsStudyProvider` API.
- **Message bus tasks** must define `MessageType` and payloads in `src/entities/message/types.ts` before background handlers and Card Creator can implement them.
- **Audio/image handling** must coordinate on cache map shape (`ReadonlyMap<string, SrsAudioAsset>` / `SrsImageAsset`) and blob URL lifecycle.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `ts-fsrs` bundle size or browser incompatibility | High | T0 spike first; fall back to vendored minimal FSRS port if needed. |
| IndexedDB `by_deck_due` cursor with wrong key encoding | High | Write `scheduler.test.ts` with `fake-indexeddb`; manually profile 1000 cards. |
| Card Creator destination change breaks Anki flow | Med | Keep `'anki'` as default; SRS path is additive behind a destination check. |
| Audio/image cache grows beyond quota | Med | Quota manager with LRU eviction; external image URLs rejected. |
| Spelling auto-advance timing feels jumpy | Med | 800ms default tunable; add manual Next fallback. |
| Multi-word/inflected masking mismatch | Low | Document V1 exact-match accepted risk; revisit per-language later. |
| E2E flake due to extension tab lifecycle | Med | Use `testing-extension-browser` helpers; add retry and wait selectors. |

## Open Questions

1. Does the T0 spike confirm `ts-fsrs@5.4.1` bundles correctly with Vite 8 and runs in the extension page context? If not, which vendored fields can be dropped?
2. Should the default `SrsLearningPathConfig.stages` remain `['sound','meaning','spelling']` for all language profiles, or be per-collection?
3. Which shared audio orchestrator method should `audioStimulusResolver` call for word vs sentence audio, and what is the expected return type (ArrayBuffer + mime)?
4. Should the first-run UI auto-create a collection for every language profile on first switch, or only when the user clicks Study/Add?
5. Are there existing `shared/ui` components (e.g., `Select`, `Slider`) with expected APIs for the SRS settings panel?
