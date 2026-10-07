# Review: phrase-pump — SPECIFY gate

> Reviewer: spec-reviewer subagent (fresh context, single pass) · Round 1

## Verdict: APPROVE_WITH_CHANGES — all 9 action items applied

All load-bearing TL claims verified true: repo signatures (`cardRepository.ts:119,128`, `noteRepository.ts:124`), `tts` permission (`manifest.json:19`), `SrsAudioAsset` bytes→Blob→objectURL→`<audio>` path (`audioStimulusResolver.ts:11`), `createTtsAudioQueue` pause via `AudioContext.suspend`, one-directional import graph — `phrasePump→{srs,miningQueue,tts}` creates no cycles. Extension-page direct-IDB confirmed (`SrsHome.tsx:8-9` precedent).

## Action items applied

| # | Finding | Fix |
|---|---|---|
| 1 | `SRS_OPEN_STUDY_PAGE` has no landing mechanism — payload is `{deckId?}` only and even that param is dead (`App.tsx` reads no query params) | REQ-5 now spells out the deep-link chain: additive `view:'pump'` field → handler query param → `location.search` init in `App.tsx`; "no new contract" reworded to additive optional field |
| 2 | User-initiated TTS stop is indistinguishable from engine failure → phantom skips (chrome.tts `stop()` leaves the speak promise hanging ~10s) | REQ-2/REQ-3 rule: post-stop settlements are discarded, never counted, never replayed |
| 3 | Sentence-field detection mis-cited `maskTarget`/`variantFront.ts`; coupled to card variants unnecessarily | REQ-1 step 3 now reads note fields directly with concrete detection order: canonical ids (`defaultNotetype.ts:5-8`) → `frontTemplates[].stimulusType` → `fieldMapping.ts:142,210` role mapping; raw values |
| 4 | Supertonic contradiction — REQ-2 wired only `createTtsEngine` but NFR-4 claimed it | NFR-4 fixed: v1 = chrome.tts/WebSpeech; opt-in `TTS_SPEAK_LOCAL`/supertonic (en-only) documented as upgrade path |
| 5 | Lean `MiningQueueRow` drops `langCode` → per-item `getQueueItem` collides with NFR-1; signature shorthand wrong; ordering ambiguous | REQ-1: batched `Promise.all` detail reads; real signature `(deckId, beforeISO, max)`; explicit order (SRS by `nextDue` asc → queue newest-first → cap) + dedupe-before-cap |
| 6 | `dictLocalSource` mis-cited as prefetch precedent; `{lang}` option key wrong; `SPEAK_TIMEOUT_MS` is module-private | Cited `prefetchAdjacentTerms` (`lookupCache.ts:113`); `{langCode}`; timeout noted as module-private constant |
| 7 | `PumpItem.cueStart` was dead; queue snapshot `audioItems[].url` playable source ignored | `cueStart` dropped; `audioUrl` field covers asset objectURL + `data:`/`https:` passthrough + queue snapshot URLs (REQ-2 step 1 mirrors `resolveReviewSurface.ts:50,63`) |
| 8 | SC-9 cited nonexistent "guard-bench" | Now names `tests/unit/` perf-bench convention with `perfAuditBench.test.ts` precedent |
| 9 | PlaylistTab launcher row would be unreachable in empty state (`PlaylistTab.tsx:208-221`) | REQ-5 requires the row outside the records conditional |

## Accepted risks (carried from review)

- 10s `SPEAK_TIMEOUT_MS` can falsely skip very long TTS sentences — revisit if skip counts spike.
- TTS pause = item-restart (not mid-utterance) — surfaced in UI hint + SC-4.
- chrome.tts may pick remote voices on some platforms — WebSpeech fallback exists.
- `loadNoteAssets` performs no writes; the actual LRU touch lives in `getCachedAudioAsset` (`audioAssetCache.ts:33`) — REQ-7 cites the correct function.

VERDICT: APPROVE
