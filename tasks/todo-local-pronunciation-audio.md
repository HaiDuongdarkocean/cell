# TODO: Local Pronunciation Audio

## Phase 1: Foundation

- [ ] Task 1: Extend types and settings schema v26
  - [ ] Add `'localFile'` to `AudioEngineKind` in `entities/settings/types.ts` and `features/pronunciation/types.ts`
  - [ ] Add `'local'` to `AudioSourceKind` and `AudioSourceKindSchema`
  - [ ] Add `LocalFileAudioSettings` to `PronunciationSettings` with `packageType: 'single' | 'split'`
  - [ ] Update `DEFAULT_PRONUNCIATION_SETTINGS`
  - [ ] Bump `CURRENT_SCHEMA_VERSION` 25 → 26 + migration
  - [ ] Verify: `npx tsc --noEmit`, settings tests pass

- [ ] Task 2: File handle storage
  - [ ] Implement `shared/lib/storage/localFileHandleStorage.ts`
  - [ ] Add permission verification helpers
  - [ ] Write unit tests with fake-indexeddb
  - [ ] Verify: tests pass

## Phase 2: Local Package Parsing

- [ ] Task 3: Lingvo DSL parser + index storage
  - [ ] Implement `lingvoDslParser.ts`
  - [ ] Implement `lingvoDslIndexStorage.ts`
  - [ ] Write parser tests
  - [ ] Write index storage tests
  - [ ] Verify: sample entries parse correctly

- [ ] Task 4: Zip audio resolver
  - [ ] Add `unzipit` dependency
  - [ ] Implement `zipAudioResolver.ts` (lazy via unzipit)
  - [ ] Implement `splitPackageResolver.ts` (select archive by pattern)
  - [ ] Write resolver tests
  - [ ] Verify: returns MP3 bytes for known path

## Phase 3: Provider + Orchestrator

- [ ] Task 5: LingvoDslAudioProvider
  - [ ] Implement `lingvoDslAudioProvider.ts`
  - [ ] Write provider tests
  - [ ] Verify: returns AudioItems; [] for missing words

- [ ] Task 6: PronunciationAudioOrchestrator
  - [ ] Implement `pronunciationAudioOrchestrator.ts`
  - [ ] Wrap community and TTS as providers
  - [ ] Write fallback chain tests
  - [ ] Verify: correct provider order

## Phase 4: Message + Integration

- [ ] Task 7: Background handler `FETCH_LOCAL_AUDIO`
  - [ ] Add `FETCH_LOCAL_AUDIO` message type
  - [ ] Add Zod schema
  - [ ] Implement background handler
  - [ ] Register handler in background index
  - [ ] Verify: handler unit tests pass

- [ ] Task 8: Wire `useDictionaryToolbar` + `AudioPanel`
  - [ ] Call `FETCH_LOCAL_AUDIO` in `fetchAudio`
  - [ ] Merge local audio into audio items
  - [ ] Update `AudioPanel` `toAudioEngineKind` for `'local'`
  - [ ] Verify: popup shows local items; phoneme playback works

## Phase 5: Settings UI

- [ ] Task 9: Local package picker in options
  - [ ] Create/extend `PronunciationSettingsPanel.tsx`
  - [ ] Add file/directory picker button
  - [ ] Show selected package + index status
  - [ ] Add fallback engine reorder (if missing)
  - [ ] Verify: settings persist across reload

## Phase 6: Verify

- [ ] Task 10: Tests + E2E
  - [ ] Unit tests for all new modules
  - [ ] Update existing tests if broken
  - [ ] Playwright E2E: select package, open popup, play word, play phoneme
  - [ ] `npm run typecheck` pass
  - [ ] `npm run lint` pass
  - [ ] `npm run test:unit` pass
  - [ ] `npm run build` pass
