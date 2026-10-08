# Spec: Mining Queue — capture in one tap, cardify in batch

> Intent: `docs/intent/mining-queue.md` · ui_surface: yes · Mode: all

## Objective

Give the immersion learner a durable capture queue: one action on a lookup result or a subtitle cue stores the item (term and/or sentence + context + source) without opening any dialog; later, a review surface inside the universal panel replays each item into the existing card-creator / Anki / Ocean-SRS sinks or discards it. Playback is never blocked; nothing captured is lost across restarts.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | tap save action (cue row) | which item to keep | toast-less quiet confirmation; queue list; per-item actions |
| Learner | open queue, cardify / quick-add / discard an item | item id | card creator prefilled; item removed |
| System (timer/env) | SW restart, browser relaunch | — | — (queue must survive; no actor input) |

## Requirements

### Functional

REQ-1: ~~Save lookup result to queue~~ — REMOVED 2026-10: the dictionary popup save affordance was dropped; the cue row is the only capture point. Legacy kind=`term` rows in user queues remain supported by cardify/quick-add replay (`queueItemToPrefill`).

REQ-2: Save cue sentence to queue (term-less)
- Actor: learner
- Goal: keep a subtitle line without choosing a word now
- Preconditions: cue list visible (subtitle panel)
- Basic flow:
  1. actor activates save on a cue row (actions slot)
  2. system builds kind=`sentence` item: `contextSentence=cue.targetText`, `translation=cue.nativeText`, source refs (videoId, cueIndex, cueStart — supplied by the SubtitlePanel/CueList context that already knows the loaded video; `sourceLabel` = page title or library video name), `term` absent
  3. same persist + confirm as REQ-1
- Alt flow: saving the current overlay cue when panel list absent — out of scope (cue list only)
- Exception: same as REQ-1
- Rules: dedupe identity for sentence items = normalized sentence (+videoId) — term not required
- Postcondition: sentence item in queue
- NFR refs: NFR-1, NFR-4

REQ-3: List queue in universal panel
- Actor: learner
- Goal: see all queued items newest-first with term/sentence/source/age
- Preconditions: universal panel open
- Basic flow:
  1. actor opens the Queue surface (panel tab `queue`, `mobileNav:'tools'` — keeps bottom rail ≤5 per up-mobile-chrome contract)
  2. system fetches queue via background message returning **lean row projections** (id, kind, term, pos, sentence, sourceLabel, cueStart, createdAt — no `lookupResult`/media lists); renders rows: term or "(sentence)", sentence text, source label + cue timestamp, relative age, queue count
  3. system live-updates the list on queue-change events
- Alt flow: empty → EmptyState with hint "save a line while watching"
- Exception: list fetch fails → inline error + retry
- Rules: only `queued` items listed; newest first
- NFR refs: NFR-2, NFR-4

REQ-4: Cardify a queued item via card creator
- Actor: learner
- Goal: turn a queued item into a full card with editing control
- Preconditions: item in queue
- Basic flow:
  1. actor activates cardify on an item
  2. system fetches the item's full snapshot, reconstructs a `PopupCardCreatorPrefill` (term items) — sentence items open with sentence only, term picked by learner in-dialog
  3. system opens the existing card-creator dialog with that prefill, threading `queueItemId` through the open context
  4. on card save success (`onSubmitSuccess`/`onAfterSubmit` hook) → system removes the item from queue
- Alt flow: media URLs in the snapshot dead → creator re-fetches what it can (existing fetch paths); item still cardifies
- Exception: learner cancels the dialog → item stays queued
- Rules: cardify reuses `openStandaloneCardCreator` / panel `sendToCard` path — no parallel card pipeline; removal on success is deterministic (not "mark maybe")
- Postcondition: card exists in the configured sink; item left queue
- NFR refs: NFR-3

REQ-5: Quick-add a queued item without the dialog
- Actor: learner
- Goal: send a queued term item straight to the configured sink (Anki quick-add flow or Ocean SRS) — completes intent S5/TO-BE-5
- Preconditions: kind=`term` item (sentence items cardify-only — no term to sink)
- Basic flow:
  1. actor activates quick-add on a term item
  2. system replays the stored prefill through the same path `handlePopupQuickAdd` uses (`'quick-add'` action → queue+Dictionary flow, or `addToOceanSrs` when destination is ocean-srs)
  3. on success → system removes the item from queue; on failure → error toast, item stays
- Exception: sink unreachable → failure toast, item retained
- Rules: identical semantics to live quick-add — same destination fork, same toasts
- NFR refs: NFR-3

REQ-6: Discard a queued item
- Actor: learner
- Goal: drop an item without making a card
- Basic flow: actor discard → system removes row → row gone (hard delete)
- Exception: none significant
- Rules: no confirm dialog for single-item discard (undo-free v1 — queue is cheap to refill)
- NFR refs: NFR-2

REQ-7: Queue change propagation
- Actor: system-internal surfaces (popup writer, queue list reader)
- Goal: every surface sees current queue
- Basic flow: any write in background store → broadcast `QUEUE_CHANGED` message → open panels refetch/update; content surfaces awaiting confirmation get write result
- Exception: listener surfaces closed → message drops harmlessly
- Rules: single background SSOT; no surface writes IDB directly (content-script IDB is page-origin — would split the queue)
- NFR refs: NFR-1, NFR-3

REQ-8: Queue cap + eviction
- Actor: system
- Goal: bounded footprint
- Basic flow: on each add, if `queued` count > 500 → evict oldest `queued` rows until ≤500
- Exception: none
- Rules: eviction drops oldest first; evicted rows are gone (documented)
- NFR refs: NFR-1

REQ-9: i18n + a11y
- All copy via en.json+vi.json; save actions icon+aria-label; touch ≥ `--touch-target`; queue list keyboard/screen-reader navigable (ListItem/MenuItem conventions)
- NFR refs: NFR-2

### Non-functional

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Queue write/read latency | P | save confirm <100ms local; list <500ms for ≤500 items |
| NFR-2 | Persona fit | U | 5–80yr, touch targets, no dialogs for capture |
| NFR-3 | Durability | R | items survive SW restart + browser relaunch; write failures surfaced, never silent (differs from sessionEvents tap) |
| NFR-4 | Local-first | +privacy | zero network at capture; media stored as URLs only |
| NFR-5 | Storage bound | +resource | ≤500 queued rows, text+URL snapshots only |

## Flows / States

Item lifecycle:

```
(none) --save→ queued --cardify-ok→ (removed)
                  └--discard→ (removed)
                  └--evict (cap)→ (removed)
```

Save dedupe: `same normalized key + still queued → touch createdAt, no new row`.

## Function ↔ Feature Map

| Function | Features |
|---|---|
| persist capture | background `miningQueueRepository` (own IDB DB `orca-mining-queue` v1, store `items`), message handlers QUEUE_ADD/LIST/GET/REMOVE/CHANGED |
| dedupe + cap | `logic/queueLogic.ts` pure fns (dedupeKey, applyCap) |
| capture affordance | CueList row save button |
| review | `QueueTab` in universalPanel (`mobileNav:'tools'`), rows via ListItem conventions — "mining queue", not to be confused with the card creator's internal `CardCreatorQueueItem` sidebar |
| cardify | adapter → `openStandaloneCardCreator` / panel `sendToCard` with rebuilt prefill + `queueItemId`; removal wired through existing `onSubmitSuccess`/`onAfterSubmit` |
| quick-add | replay through `handlePopupQuickAdd` sink fork ('quick-add' → Dictionary flow / `addToOceanSrs`) |
| count surfacing | queue count in tab label row header (inside tab; no global badge v1) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| MiningQueueItem | id, kind, term?, pos?, langCode, sentence, translation?, sourceLabel?, videoId?, cueIndex?, cueStart?, createdAt, snapshot (serializable subset of `PopupCardCreatorPrefill`) | IDB `orca-mining-queue`/`items` (background-owned via messages) | until cardify/quick-add/discard/evict; hard cap 500 queued |

Snapshot strip rules — persisted `snapshot` excludes: `AudioItem.audioBytes`/`audioBytesB64` (bytes never persisted), `DictionaryPanelPrefill.video`/`initialMedia`/`cue` live refs, `MediaFile` blobs. URLs (`wordAudioUrls`/`sentenceAudioUrls`/`imageUrls`), `lookupResult`, `audioItems`/`imageItems` metadata (id/title/url only) persist.

Projection split: `QUEUE_LIST` returns lean rows (no `lookupResult`, no media lists); `QUEUE_GET` returns the full snapshot for cardify/quick-add — keeps list payload small at ≤500 items.

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 one-tap save on lookup | REQ-1 | SC-1 |
| N2 cue sentence capture | REQ-2 | SC-2 |
| N3 durable across restart | REQ-7, NFR-3 | SC-3 |
| N4 review surface | REQ-3 | SC-4 |
| N7 queue visible | REQ-3 (tab + count) | SC-4 |
| N5 dedupe | REQ-1/2 rules + queueLogic | SC-5 |
| N6 bounded | REQ-8 | SC-6 |
| N8 replay prefill | REQ-4 | SC-7 |
| S5/TO-BE-5 quick-add sans dialog | REQ-5 | SC-10 |
| discard | REQ-6 | SC-8 |
| change propagation | REQ-7 | SC-3, SC-4 |
| i18n/a11y | REQ-9 | SC-9 |

| Journey step | REQ |
|---|---|
| TO-BE 2 (tap save, uninterrupted) | REQ-1, REQ-2 |
| TO-BE 4–5 (open queue, review, cardify/discard) | REQ-3, REQ-4, REQ-5 |
| TO-BE 6 (nothing lost) | REQ-6, REQ-7, NFR-3 |

## Boundaries

- Always: background-owned store + message API (page-origin IDB split is forbidden); reuse `PopupCardCreatorPrefill`; i18n both locales; tokens via `tokens.json`; ListItem/Menu/EmptyState shared atoms.
- Ask first: new manifest permission, new dependency, touching `up-mobile-chrome` rail rule (resolved: `mobileNav:'tools'`).
- Never: silent write failure; per-surface IDB writes; auto-create cards without user action; copy media bytes at capture.

## Success Criteria

- [x] SC-1: REMOVED 2026-10 — dictionary popup save dropped; cue row is the only capture point.
- [ ] SC-2: From a cue row, one activation saves a sentence item carrying cue text + source ref.
- [ ] SC-3: Items persist across service-worker sleep and browser relaunch (verified by reopening the panel list).
- [ ] SC-4: Queue tab lists queued items newest-first with term-or-sentence, source, age, and total count; empty state exists.
- [ ] SC-5: Saving the same term+sentence twice yields one row (updated timestamp); same for identical sentence saves.
- [ ] SC-6: Queue never exceeds 500 queued rows; oldest evict first.
- [ ] SC-7: Cardify opens the existing card creator with term/definitions/sentence/media context equal to live-capture prefill (sentence items open with sentence context only); successful save removes the item.
- [ ] SC-8: Discard removes the item without a card.
- [ ] SC-9: All copy localized en+vi; save affordances meet `--touch-target`; no new manifest permissions.
- [ ] SC-10: Quick-add on a term item routes to the configured sink (Anki quick-add or Ocean SRS) without opening a dialog; success removes the item, failure keeps it with an error toast.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI pass through design stage (concepts → mockup → mapping) and design-system check
- [ ] Browser verify: save from cue, restart SW, cardify, discard — on a real page
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated

## Alternatives considered

- **Reuse `orca-local-player` DB + new store** — rejected: forces a version bump/migration on a foreign-owned DB; own DB `orca-mining-queue` v1 is isolated and cheap.
- **Reuse sessionRecap's `SESSION_EVENTS` store** — rejected: events are fire-and-forget append-only stats, not durable user-owned items; NFR-3 requires awaited writes + surfaced failures.
- **Reuse card creator's `CardCreatorQueueItem` sidebar** — rejected: that's an in-dialog field queue (items-into-one-card), not a cross-session capture queue; naming kept distinct (`mining queue` vs `card queue`).
- **`chrome.storage.local` instead of IDB** — rejected: snapshots carry `lookupResult` objects; IDB structured-clone + indexing beats JSON serialization and storage quotas.
- **Content-script direct IDB** — rejected: page-origin vs extension-origin split would produce two queues; background-owned store + messages is the established wordStatus pattern.

## Open Questions / Accepted Risks

- Queue surface = dedicated `queue` tab in `mobileNav:'tools'` (accepted risk: less prominent on mobile; keeps rail contract).
- No global count badge v1 — count inside tab header row (reviewer noted no per-tab badge precedent; avoids inventing one mid-loop).
- Media URLs in snapshots may expire before cardify — accepted; creator re-fetches, card still creatable.
- No undo for discard — queue refill is cheap (accepted).
- Sentence items on stream surfaces carry `videoId`/`cueIndex` refs that may not resolve later — text snapshot is the durable part (accepted).
