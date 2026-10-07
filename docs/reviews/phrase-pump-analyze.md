# Review: phrase-pump — ANALYZE gate

> Reviewer: fresh-context subagent_explore · Round 1

## Verdict: REVISE → applied → APPROVE

Every file:line claim in the intent doc was re-verified against the codebase. All factual citations held; four real inaccuracies were found and fixed in the doc before transition.

## Findings and applied fixes

| # | Finding | Severity | Applied fix |
|---|---|---|---|
| F1 | `createTtsEngine` selects only chrome.tts→WebSpeech; supertonic is a separate offscreen engine via `TTS_SPEAK_LOCAL`, English-only voice `supertonic-v3-en` | factual | Corrected Business Case, Stakeholders, Risks rows |
| F2 | "Existing message contracts" false for SRS reads — no cs→bg message returns due cards/notes; universal panel mounts only in content scripts which cannot read extension IDB | scope | N7 rescoped: v1 playback lives on `srs-study` extension page; panel gets a launcher via existing `SRS_OPEN_STUDY_PAGE` |
| F3 | TTS engine API has no pause — `speak/stop` only (`ttsEngineService.ts:28-32`); no `TTS_STOP` message either | requirement honesty | N3 rewritten: pause = item-boundary stop unless bytes play via `<audio>`/`ttsQueue` (which does pause) |
| F4 | TTS constraints unmentioned: `SPEAK_TIMEOUT_MS` 10s rejects long utterances; `translate_tts` truncates at 200 chars and is network-bound | requirement honesty | N5 + Risks now state both |
| F5 | `MiningQueueRow` lean projection drops `langCode`/`translation` — pump needs `QUEUE_GET` per item or profile-lang fallback | detail | N8 now states the resolution path (`queueLogic.ts:116-127`, `capture.ts` precedent) |
| F6 | Closer precedent than `condensedAudioRecorder` (a recorder, not a player): reader `TtsControlBar.tsx:49-95` — already a sentence-stepper with prev/next/repeat | citation | N3 cites TtsControlBar as the primary precedent |
| F7 | "Playlist tab hosts audio sessions" loose — it hosts recordings, not sessions | nit | Context row reworded |

## Verified-true claims (kept)

- `getCardIdsByDeckDueBefore` (`cardRepository.ts:119`), `getCardsByIds` (`:128`), `getNotesByIds` (`noteRepository.ts:124`), `loadNoteAssets` (`noteAssetLoader.ts:82`) — due-pool + asset pipeline exists.
- `listQueueRows` (`miningQueueRepository.ts:118`) — queue rows carry `sentence`/`term`/`pos`/`cueStart`/`createdAt`.
- Sentence-level `speak` exists end-to-end: reader `TtsControlBar.tsx:54`, popup `TTS_SPEAK` via `useCandidate.ts:398-405`, background `handlers/tts.ts:44`.
- No existing passive-listening/phrase-pump feature — only reader's paragraph-bound `TtsControlBar` and file-based condensed audio.
- SRS sentence field is convention not guarantee (`defaultNotetype.ts:5,8`) — N5 honest.
- Stored `sentAudio` assets resolve to extension-origin blob URLs — reinforces the F2 scope decision (panel can't play them directly).

VERDICT: APPROVE
