# Spec: Phrase Pump — hands-free listening loop over due SRS sentences + mined queue

> Intent: `docs/intent/phrase-pump.md` · ui_surface: yes · Mode: all

## Objective

Give the immersion learner a passive reinforcement loop: pick sources (due SRS cards and/or mining-queue saves), press play, and hear each item's sentence audio back-to-back — stored sentence audio when the note has it, TTS synthesis otherwise — with repeat/gap/shuffle/skip controls and a glanceable now-playing surface. The pump lives on the `srs-study` extension page (direct IDB + TTS engine access); listening is exposure only — it never writes to scheduling state.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | open pump, pick sources + loop settings, press play | deck scope (all/specific), include-queue toggle, repeat N, gap, shuffle | session list builds; audio plays continuously; now-playing shows sentence + term + position |
| Learner | pause/skip/stop during playback | control activation | playback responds per audio-source semantics; position/state visible |
| System | item audio resolution | per-item fields | stored asset → `<audio>`; else TTS speak; unresolvable → skipped+counted |

## Requirements

### Functional

REQ-1: Build a pump session
- Actor: learner
- Goal: an ordered playable list from real user content
- Preconditions: `srs-study` page open
- Basic flow:
  1. actor picks source scope: SRS due cards — deck selector (all decks across collections, or one deck incl. subdecks) — plus a "mined queue" toggle
  2. deck resolution mirrors `resolveDeckIds` semantics (`selectNextReview.ts:16` — module-private; pump source extracts/reimplements it): "all decks" enumerates `getAllCollections` → `getDecksByCollection` (`collectionRepository.ts:66`); a single deck optionally includes subdecks
  3. system collects due cards via `getCardIdsByDeckDueBefore(deckId, nowISO, max)` (`cardRepository.ts:119`) + `getCardsByIds` + `getNotesByIds`; sentence/sentAudio/target fields detected on the **note** (not card variants) in this order: canonical field ids `sentence`/`sentAudio`/`targetWord` (`defaultNotetype.ts:5-8`) → `frontTemplates[].stimulusType === 'sentence'` field targets → ankiImport role→id mapping (`fieldMapping.ts:142,210`); raw field values are read (masking is display-only)
  4. queue toggle adds mining-queue items with non-empty `sentence` — `listQueueRows` (newest-first) then batched `Promise.all(getQueueItem(id))` detail reads for `langCode` + snapshot audio URLs (extension-origin IDB — direct repo reads, no message contract)
  5. ordering: filter unplayable-text items → dedupe normalized sentence text across sources (SRS wins; reuse `queueLogic` normalization or equivalent) → SRS items sorted by `card.nextDue` ascending → queue items appended newest-first → cap at 200
- Alt flow: SRS source yields zero → queue-only session if toggle on; both empty → empty state, play disabled
- Exception: repo read fails → inline error + retry
- Rules: session is ephemeral (not persisted); dedupe before cap; queue detail reads are batched, never per-item await loops
- Postcondition: ordered `PumpItem[]` ≤200 ready
- NFR refs: NFR-1, NFR-4

REQ-2: Resolve item audio
- Actor: system
- Goal: every playable item produces audio via the cheapest durable source
- Basic flow:
  1. item has stored audio → play through `<audio>` (true pause/resume). Sources, mirroring `resolveReviewSurface.ts:50,63`: `sentAudio` field asset via `loadNoteAssets`/`audioAssetCache` (bytes→Blob→objectURL, `audioStimulusResolver.ts:11`), or raw field values already `data:`/`https:` (uncached passthrough — still `<audio>`-playable), or queue-snapshot `audioItems[].url` for queue items
  2. else → TTS via `createTtsEngine().speak(text, { langCode })` (`TtsSpeakOptions`, `ttsEngineService.ts:22`); lang chain: queue item `langCode` → deck's collection language if present → active profile `resourceLangCode` (`capture.ts` precedent)
  3. next item's audio resolves while current plays (prefetch-1 — same pattern as `prefetchAdjacentTerms`, `lookupCache.ts:113`)
- Alt flow: sentence >200 chars → still `speak()` (engine path has no char cap — the 200-char `translate_tts` limit belongs to `TTS_FETCH_AUDIO`, which pump does not use); utterance exceeding the engine's internal 10s timeout (`SPEAK_TIMEOUT_MS`, module-private `ttsEngineService.ts:60`) → item counted timed-out and skipped
- Exception: no TTS voice for lang, engine error, or timeout → item skipped, `skipped` counter incremented, session continues
- Rules: engine failures never abort the session; a `speak()` settlement arriving **after** a user-initiated stop/skip is discarded — never counted as a skip, never replayed (chrome.tts `stop()` leaves the engine promise hanging until timeout; the player must not treat that as failure). Opt-in local TTS (`localTtsEnabled`/`localTtsLanguage` → `TTS_SPEAK_LOCAL` → supertonic offscreen, English-only) is a documented upgrade path, out of v1.
- NFR refs: NFR-2, NFR-3

REQ-3: Playback controls
- Actor: learner
- Goal: loop control without looking
- Basic flow: play/stop, skip-next/skip-prev, repeat-per-item selector (1×/2×/3×), gap selector (off/1s/2s/4s), shuffle toggle (reorders remaining items, current stays)
- Pause semantics (honest to source): asset-backed item → true pause/resume via `<audio>`; TTS-backed item → pause = engine `stop()`, resume replays the item from its start — identical "pause" button, documented difference in the surface hint
- Alt flow: changing repeat/gap/shuffle mid-session applies to subsequent items
- Exception: engine `speak` promise rejects mid-item → REQ-2 skip — **unless** the rejection follows a user-initiated stop/skip, in which case it is discarded silently (REQ-2 rule)
- Rules: controls meet `--touch-target`; keyboard operable; no grading UI anywhere; user-initiated interruptions never increment `skipped`
- NFR refs: NFR-2

REQ-4: Now-playing surface
- Actor: learner
- Goal: glance tells what/where without reading a paragraph
- Basic flow: shows current sentence (large type), target term highlighted when known, position `i/n`, source chip (`due`/`queue`), skipped counter when >0; text-reveal toggle hides the sentence for pure-listening mode (audio-only shadowing)
- Alt flow: reveal off → term chip still shows
- Rules: one glanceable pane; uses panel primitives + `tokens.json`; no modal
- NFR refs: NFR-2

REQ-5: Entry points
- Actor: learner
- Goal: reach pump from where the learner already works
- Basic flow:
  1. `SrsHome` gains a pump action (listen affordance alongside study actions) → switches to pump view on the same page
  2. universal-panel `PlaylistTab` gains a "phrase pump" launcher row — rendered **outside** the records conditional so it survives the empty state (`PlaylistTab.tsx:208-221` renders EmptyState in place of the list) — → sends `SRS_OPEN_STUDY_PAGE` with an additive optional `view: 'pump'` field on the existing payload (`types.ts:1040-1043`, `schema.ts:271-273`)
  3. handler passes the field through as a query param (today it appends `?deckId=` — `handlers/srs.ts:85-89`; the current `deckId` param is actually dead); `srs-study` `App.tsx` gains `location.search` init (none exists today — `App.tsx:16` view is internal state) to land on the pump view
- Rules: no new manifest permission; additive optional field on the existing message — no new message type; `srs-study` keeps direct IDB access
- NFR refs: NFR-2

REQ-6: Empty and unplayable states
- Actor: learner
- Goal: never a silent dead screen
- Basic flow: no due cards + queue empty/disabled → EmptyState with hint to mine/study first; all items unplayable → end state summarizes played/skipped; session complete → summary (played n, skipped n) + restart affordance
- NFR refs: NFR-2

REQ-7: No scheduling side effects
- Actor: system
- Goal: listening never mutates learning state
- Basic flow: pump performs reads only; FSRS state, card components, deck presets untouched; `getCachedAudioAsset` LRU-touch (`audioAssetCache.ts:33`) is accepted — asset cache, not learning state (`loadNoteAssets` itself performs no writes, `noteAssetLoader.ts:82-99`)
- Rules: no `putCard`, no review-result writes, no queue-row mutation from pump
- NFR refs: NFR-5

REQ-8: i18n + a11y
- All copy via en.json+vi.json; controls icon+aria-label; touch ≥ `--touch-target`; now-playing text readable at glance (`--font-size-*` scale); session controls keyboard-operable
- NFR refs: NFR-2

### Non-functional

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Session build latency | P | ≤1s for ≤200 items on persona hardware (indexed due-queries + batched note reads; no per-item awaits) |
| NFR-2 | Persona fit | U | 5–80yr — minimal controls, big text, honest pause semantics, clear empty/end states |
| NFR-3 | Playback continuity | R | next-audio prefetch during current play; engine skip path never aborts session |
| NFR-4 | Local-first | +privacy | zero required network (stored assets + chrome.tts/WebSpeech); pump never calls `TTS_FETCH_AUDIO`; opt-in supertonic local TTS is a later upgrade path |
| NFR-5 | Writes-free | R | zero writes to SRS scheduling state / queue rows; asset-cache LRU touch accepted |

## Flows / States

```
sources picked → building → ready ──play──► playing ──item end──► next (repeat/gap applied)
                                   │             ├─ pause(asset) → paused → resume same position
                                   │             ├─ pause(tts)   → paused → resume item from start
                                   │             ├─ skip next/prev → adjacent item
                                   │             ├─ engine fail → item skipped++, advance
                                   │             └─ stop → ready (list kept)
                                   └── empty → empty-state
playing (last item done) → summary (played/skipped) → restart | change sources
```

## Function ↔ Feature Map

| Function | Features |
|---|---|
| session build | `features/phrasePump/logic/sessionBuilder.ts` — pure list assembly + dedupe + cap; `services/srsPumpSource.ts` (due-cards→sentence items), `services/queuePumpSource.ts` (queue rows→items; direct repo — extension page) |
| audio resolution | `services/pumpAudioResolver.ts` — stored-asset → `<audio>` path, else `createTtsEngine().speak`; prefetch-1 during playback; lang chain resolution |
| playback | `services/pumpPlayer.ts` — ordered player (repeat/gap/shuffle/skip/pause-semantics per source); item-level state machine |
| surface | `features/phrasePump/ui/PumpPanel.tsx` mounted as a section on `srs-study` (`SrsHome` entry); PlaylistTab launcher row → `SRS_OPEN_STUDY_PAGE` |
| consumption-only edges | reads `features/srs` repositories + `features/miningQueue` repository + `features/tts` engine — no new ownership, no cross-feature writes; feature-cycle rules apply (lazy port if an edge would cycle) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| PumpItem | id, source (`srs`\|`queue`), refId (cardId\|queueItemId), term?, sentence, langCode, audioUrl? (objectURL / data: / https: — from `sentAudio` asset, raw field value, or queue snapshot `audioItems[].url`) | memory only — session-scoped | dropped on stop/session end; never persisted |

No new store, no new DB, no new message types (extension-page direct reads; launcher adds an optional `view` field on the existing `SRS_OPEN_STUDY_PAGE` payload).

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 session list from due+queue | REQ-1 | SC-1 |
| N2 audio resolution asset→TTS | REQ-2 | SC-2 |
| N3 loop knobs + honest pause | REQ-3 | SC-3, SC-4 |
| N4 glanceable now-playing | REQ-4 | SC-5 |
| N5 unplayable skip+count | REQ-2, REQ-6 | SC-6 |
| N6 no scheduling writes | REQ-7 | SC-7 |
| N7 entry where learner lives | REQ-5 | SC-8 |
| N8 i18n + lang resolve | REQ-8, REQ-2 | SC-9 |

| Journey step | REQ |
|---|---|
| TO-BE 1 (press play, due+queue sentences flow) | REQ-1, REQ-2, REQ-3 |
| TO-BE 3 (glance shows what's playing) | REQ-4, REQ-6 |
| TO-BE 4 (ends; review state untouched) | REQ-6, REQ-7 |

## Boundaries

- Always: reads-only consumer of `features/srs` + `features/miningQueue`; playback surface on extension page (`srs-study`); shared atoms + `tokens.json`; i18n both locales; prefetch-1 to hide TTS latency.
- Ask first: new manifest permission, new dependency, new message types (none needed v1), persisting sessions.
- Never: FSRS/scheduling writes from pump; queue-row mutation; `TTS_FETCH_AUDIO` (network+200-char cap); SW-based playback; blocking UI while a session builds.

## Success Criteria

- [ ] SC-1: Picking sources builds an ordered session of ≤200 items combining due SRS sentences and queue saves; identical sentences dedupe (SRS wins); empty sources produce a disabled play + empty state.
- [ ] SC-2: Items with stored sentence audio play it via `<audio>`; items without synthesize via `createTtsEngine().speak` with the resolved lang chain; next item's audio is resolved during current playback.
- [ ] SC-3: Repeat (1×/2×/3×), gap (off/1s/2s/4s), shuffle (remaining), skip next/prev, and stop all behave per spec on a mixed-source session.
- [ ] SC-4: Pause on an asset-backed item resumes at position; pause on a TTS item restarts that item on resume — the surface communicates the difference.
- [ ] SC-5: Now-playing shows sentence, highlighted term (when known), `i/n`, source chip; reveal toggle hides text for audio-only listening.
- [ ] SC-6: An item with no voice/timeout is skipped and counted; a session of only-unplayable items ends with a played/skipped summary, never a stuck spinner.
- [ ] SC-7: FSRS `due`/`fsrsState`, card components, and queue rows are byte-identical before/after a full session.
- [ ] SC-8: Pump is reachable from `SrsHome` and via the PlaylistTab launcher (lands on pump section through `SRS_OPEN_STUDY_PAGE`); no new manifest permissions or message contracts.
- [ ] SC-9: All copy localized en+vi; controls meet `--touch-target`; session build for a 200-item fixture is measured in a unit test (`tests/unit/` perf-bench convention, `perfAuditBench.test.ts` precedent) under the NFR-1 budget.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI pass through design stage (concepts → mockup → mapping) and design-system check
- [ ] Browser verify on real srs-study page: build session, play through ≥3 mixed items (asset + TTS + skipped), pause/resume semantics, summary state
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated

## Alternatives considered

- **Panel-hosted pump with new SRS session/asset message contract** — rejected for v1: content scripts can't read extension IDB or play extension-origin blob URLs; shipping bytes over messages (chunked base64 precedent exists for condensed audio) adds a contract + codec layer for no user-visible gain while `srs-study` already has direct access. Panel gets the launcher row instead; a message-contract port stays a documented upgrade path (together with opt-in `TTS_SPEAK_LOCAL`/supertonic).
- **Queue-of-bytes via `TTS_FETCH_AUDIO` for uniform `<audio>` pause** — rejected: network-bound and 200-char truncation makes mined sentences unreliable; `speak()` engine path is local and unbounded (modulo 10s timeout handled as skip).
- **Persist sessions / resume-where-left** — rejected per intent scope: session is re-derivable in <1s; persistence adds a store for marginal value.
- **Extend `condensedAudioRecorder`** — rejected at intent: wrong source semantics (file cue-ranges vs SRS/queue items).
- **Count listens toward scheduling (familiarity bump)** — rejected: silently mutates learning state; if wanted later it belongs behind an explicit opt-in.

## Open Questions / Accepted Risks

- TTS pause = item-restart (not mid-utterance) — accepted; surfaced in the UI hint and SC-4.
- Supertonic covers English only — non-English decks rely on chrome.tts/WebSpeech voices; skipped-item counter makes coverage gaps visible.
- `SPEAK_TIMEOUT_MS` 10s may cut very long sentences → counted as skips, accepted v1 (spec's max-length policy: none — timeout-skip is the policy).
- Deck-scope language resolution: if a deck's collection carries no language field, profile `resourceLangCode` fallback applies (verify at build; mismatched voice is a cosmetic miss, not a failure).
- Now-playing on `srs-study` only — a floating mini-player for content pages is a follow-up (needs the message contract above).
