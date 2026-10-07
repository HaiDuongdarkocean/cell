# Intent: Phrase Pump — passive listening drills over your own mined sentences

> Slug: `phrase-pump` · Mode: all · Source: backlog row #35 (languagereactor)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Learners accumulate due SRS cards and mined sentences but every interaction with them is screen-bound and active-tap. The minutes they could spend reinforcing — walking, cooking, commuting — stay empty; retention depends on sessions they cannot always give. | `selectNextReview.ts:63` — review flow is one-card-at-a-time, tap-to-answer; LR sells exactly this gap as PhrasePump (languagereactor.com) | high |
| Change | From "SRS = sit down and review" → to "SRS audio can flow hands-free". A listening session plays sentences containing due/learned items back-to-back — no interaction required. | Direction only; session shape decided in spec+design | high |
| Solution | A phrase-pump engine that pulls due (and optionally newly mined queue) sentences, resolves each to audio — stored sentence audio first, TTS fallback — and plays them as a continuous playlist with repeat/gap controls. | `cardRepository.ts:119` (`getCardIdsByDeckDueBefore`), `loadNoteAssets` (`noteAssetLoader.ts:82`), `createTtsEngine` (`ttsEngineService.ts:185` — chrome.tts + WebSpeech; supertonic is a separate offscreen engine via `TTS_SPEAK_LOCAL`, English-only today at `supertonicTtsEngine.ts:12-17`) | high |
| Value | Reinforcement time the user literally did not have before; due items get extra exposure without tapping; mined sentences from `mining-queue` become listenable instead of inert rows. | LR PhrasePump is a headline paid feature; spaced repetition audio review is the proven drill | high |
| Stakeholder | Immersion learners (persona 5–80, any device, RAM ≥1GB) with an SRS deck or mining-queue entries. | AGENTS.md persona | high |
| Context | MV3 local-first extension; SRS study lives in its own entrypoint (`srs-study/`) with direct IDB + TTS access; sentence-audio assets + TTS engines already exist; universal panel hosts a `playlist` tab for condensed-audio recordings and mounts only in content scripts. | `src/entrypoints/srs-study/`, `panelTabs.ts:19`, `features/condensedAudio/`, `featureInit.ts:73` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers | Reuse SRS pool resolution + audio asset pipeline + TTS engine — no new storage subsystem | `features/srs`, `features/tts`, `features/miningQueue` all exist; scope M |
| Customer | Immersion learner | Start a listening session in seconds; hands-free; knows what's playing when they glance | Persona 5–80 — controls must be minimal, large, glanceable |
| Supplier/Dependency | chrome.tts / WebSpeech; supertonic offscreen engine (English-only voice `supertonic-v3-en`); `translate_tts` fetch path is network-bound and truncates at 200 chars (`ttsFetchAudio.ts:25,88`) | Pump must degrade gracefully when no stored audio and no TTS voice for target lang | `ttsEngineService.ts` chrome.tts→WebSpeech fallback; supertonic reachable only via `TTS_SPEAK_LOCAL` → offscreen (`ttsRunner.ts:14`) |
| Organization | Future contributors | Phrase-pump is a consumer of SRS/mining-queue, not an owner of card data — no writes to scheduling state | listening ≠ review: FSRS state must not change |

## Needs

| ID | Need | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Build a session list of items to hear — due SRS cards (across decks/collection) and optionally mining-queue saved sentences | F | `getCardIdsByDeckDueBefore` + `getCardsByIds` + `getNotesByIds` + `listQueueRows` all exist | high |
| N2 | Resolve each item to playable audio: stored sentence audio where the note has it; TTS synthesis otherwise | F, R | `loadNoteAssets` (`noteAssetLoader.ts`), `audioAssetCache`; `createTtsEngine().speak(text, opts)` multi-engine | high |
| N3 | Sequential playback with the loop knobs listeners need: repeat each item N×, gap between items, shuffle, stop, skip next/prev. Pause semantics depend on audio source — TTS engines expose `speak/stop` only (`ttsEngineService.ts:28-32`; reader spec documents no true pause at `docs/specs/reader.md:10`), so pause = stop-at-item-boundary unless playing fetched/stored bytes through `<audio>`/`createTtsAudioQueue` | F | reader `TtsControlBar.tsx:49-95` is the closest precedent — a sentence-stepper with prev/next/repeat already; `ttsQueue.ts` supports real pause over AudioBuffers | high |
| N4 | Glanceable "now playing": current sentence + target term + position (i/n); optional text reveal toggle for shadowing | F, U | LR PhrasePump shows phrase during play; persona needs big text, no clutter | high |
| N5 | Session works when an item has no usable audio or text — skip it, count skips, surface "nothing playable" empty state | R | notetype fields are free-form `Record<string, SrsFieldValue>` — a `sentence` field is convention, not guarantee (`defaultNotetype.ts:5,8`); TTS `SPEAK_TIMEOUT_MS = 10000` (`ttsEngineService.ts:60`) can falsely mark long sentences unplayable | high |
| N6 | No scheduling side effects — listening is exposure, not review; card FSRS state unchanged | R | SRS integrity; `[assumption: user may want "heard counts as pass" later — out of scope]` | high |
| N7 | Entry point where the learner already lives — **v1 scope: playback surface lives in `srs-study` (extension page, direct IDB + `createTtsEngine` access; `SrsHome` already imports repositories directly); universal panel gets a launcher via existing `SRS_OPEN_STUDY_PAGE`** | U | `panelTabs.ts` registry; `SrsHome.tsx`; panel-mounted pump would need a new SRS session/asset message contract that does not exist (`messages.ts:105-107` — only SRS_ADD_NOTE/GET_DECKS_NOTETYPES/OPEN_STUDY_PAGE today) | high |
| N8 | Localized en+vi; queue items resolve `langCode` via `QUEUE_GET` detail or active-profile `resourceLangCode` fallback — lean `MiningQueueRow` drops it (`queueLogic.ts:116-127`) | I | i18n convention; `capture.ts` langCode fallback precedent | high |

## Scope

- **In:** session builder (SRS due pool + optional mining-queue source), audio resolution (stored asset → TTS fallback), sequential player with repeat/gap/shuffle/skip controls (pause semantics honest to engine capability), now-playing surface on the `srs-study` page, empty/skip states, i18n.
- **Out:** writing to FSRS/scheduling from listens, persisting pump playlists across restarts, cloud sync, timer/sleep automation, background (service-worker) long-running audio — pump runs while its surface is open.
- **Non-goals:** not a second review mode (no grading, no recall), not condensed-audio re-cut (condensed audio is file-based; pump is SRS/queue-item-based), not TTS engine work (engines exist).

## Workflow

Learner opens the pump surface (panel playlist or SRS home), picks source (due cards / queue / both) and loop settings (repeats, gap, shuffle), presses play. For each item the player resolves audio — the note's own sentence audio if stored, otherwise TTS — plays it N times with the configured gap, shows the sentence + target term and position. User can pause, skip, or stop; empty source or all-unplayable items produce clear states. Session ends after the last item; nothing is written back to scheduling state.

## Journey

### AS-IS

1. Learner finishes immersion; has 40 due cards and 6 saved queue sentences.
2. The only reinforcement path is the screen-bound review session — one card at a time, taps required.
3. During dead time (commute, chores) the deck sits untouched.
4. Due cards get fewer exposures; mined sentences stay inert rows.

### TO-BE

1. Learner opens pump, presses play — due sentences + queued saves start flowing as audio.
2. Hands-free reinforcement happens during dead time.
3. Glancing at the surface shows what's playing and where in the loop.
4. Session ends; review state untouched — the deck was *exposed to*, not *graded*.

## Alternatives

| Option | Why not / why |
|---|---|
| Extend `condensedAudio` to pump | Condensed audio rebuilds a video's audio minus silence — different source (file cues, not SRS items), different UX (playlist of recordings). Pump consumes item semantics, not cue ranges. |
| Auto-play audio inside review session | Keeps pump screen-bound — misses the core need (hands-free dead time). |
| Play via background service worker | MV3 SW lifetime + offscreen-doc audio constraints make it fragile for v1; persona uses pump while browsing anyway. Out of scope. |
| **Chosen** | Dedicated pump engine over existing SRS/queue/TTS/audio-asset primitives — all writes-free, all reuse. |

## Risks

| Risk | Mitigation |
|---|---|
| Many notes lack sentence audio → pump depends on TTS quality | Stored `sentAudio` assets take priority; TTS fallback has chrome.tts→WebSpeech redundancy; supertonic (local, offscreen via `TTS_SPEAK_LOCAL`) helps English decks only; skip-and-count policy keeps session moving |
| Long sessions × TTS calls = CPU/time | Cap session length (e.g. ≤200 items), prefetch next item's audio during current playback — same prefetch pattern as `dictLocalSource` blob pipeline |
| Long TTS utterances | `SPEAK_TIMEOUT_MS` 10s + `translate_tts` 200-char cap can cut/fail long sentences — spec picks per-source audio strategy and a sane max-length policy |
| Offscreen/SW audio constraints | Player runs inside the `srs-study` extension page (direct IDB + engine access), not in SW; panel is a launcher only via `SRS_OPEN_STUDY_PAGE` |
| Persona confusion: "did listening count as review?" | Copy + placement state it explicitly; no grade UI |

## Decision

go — Cost M estimated at backlog; primitives verified present (due-query, note assets, chrome.tts/WebSpeech + supertonic-en engine, queue rows, srs-study page with direct access). Two caveats absorbed from review: v1 playback scoped to `srs-study` (no new SRS message contract needed), and pause semantics constrained by engine API. Reuse-heavy, writes-free, reversible — a clean consumer feature.
