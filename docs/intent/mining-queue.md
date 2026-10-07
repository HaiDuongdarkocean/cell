# Intent: Mining Queue — save a line in one tap, cardify later in a batch

> Slug: `mining-queue` · Mode: all · Source: backlog row #34 (asbplayer+languagereactor)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | During immersion, every card-creation attempt forces an interrupt (popup → dialog → fields → save). Learners either break flow dozens of times per video or abandon mining entirely and lose sentences worth keeping. | `cardCreatorBridge.ts:682` (`handlePopupQuickAdd` still routes through Dictionary/queue flow); asbplayer issue #273 — users asking for batch export specifically to "immerse uninterrupted" | high |
| Change | From "create a card" being an immediate, modal, per-item decision → to "capture now (1 tap), decide later (batch review)". | `popupTypes.ts:399` — `PopupCardCreatorPrefill` is already a self-contained snapshot (term, defs, sentence, media, lookupResult) — the unit a queue can persist and replay | high |
| Solution | A durable mining queue: capture affordances where lookup/cues already live, a review surface that replays saved context into the existing card-creator/Anki/SRS sinks. | Direction only; store/UX decided in spec+design | high |
| Value | Uninterrupted viewing (persona's <3s, no modal mid-scene) + zero lost "good sentences"; review session becomes a deliberate batch instead of N interruptions. | asbplayer README mining-history; LR saved phrases (languagereactor.com/help/export) | high |
| Stakeholder | Immersion learners mining subtitles/web (persona 5–80, any device, RAM ≥1GB). | AGENTS.md persona | high |
| Context | MV3 local-first extension; session capture precedent exists (`sessionEventsTap.ts:96` passive tap → `addSessionEvent`); vocab/recap surfaces live in universal panel. | `sessionEventsTap.ts`, `sessionGrouper.ts`, universalPanel tabs | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers | Reuse existing persistence + prefill contracts; no new subsystem | cardCreator prefill + IDB repo patterns exist; scope M |
| Customer | Immersion learner | Save without stopping playback; review queue anytime; never lose a queued item on restart | Persona 5–80 — affordances must be discoverable, touch-sized |
| Supplier/Dependency | AnkiConnect (optional), Ocean SRS | Queue must not hard-require either — cardify targets whichever sink is configured | `deps.getSrsDestination()` already forks ocean-srs vs anki (`cardCreatorBridge.ts:683`) |
| Organization | Future contributors | Queue entity must be a clean feature with store/repo boundary like sibling features | `features/*` convention: logic/services/ui + barrel |
| Regulator | none — no new network, no new permissions | all local data, existing surfaces only |

## Needs

| ID | Need | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | One-tap "save for later" on a lookup result (popup/panel) without opening card dialog | F | Missing today — actions are quick-add / send-to-card only (`useCandidate.ts:418`, `cardCreatorBridge.ts:682`) | high |
| N2 | One-tap capture of a subtitle cue's sentence (word choice deferrable) | F | asbplayer "mine current subtitle" precedent; cue context exists in `lookupCue` plumbing (`cardCreatorBridge.ts` sendToCard path) | high |
| N3 | Queue persists across restart/profile switch, survives SW sleep | R | IDB repository precedent: `mediaLibraryRepository.ts` | high |
| N4 | Review surface: list saved items with term + sentence + source/time; per-item cardify (full dialog or quick path) / discard | F, U | LR saved-items list + asbplayer mining history as market proof | high |
| N5 | Dedupe — same term+same sentence saved twice must not double-queue | R | `importSource`-style dedupe precedent in ankiImport | medium `[assumption: term+sentence pair as identity]` |
| N6 | Bounded footprint — queue capped (e.g. 500 FIFO), media not copied at capture | P | Persona RAM ≥1GB; media URLs may expire → re-resolve at cardify time via stored `lookupResult`/term re-lookup | high |
| N7 | Queue state visible — count badge / entry point from where the user already works | U | universalPanel tab/badges precedent | medium |
| N8 | Cardify replays selections — saved prefill opens card creator with same term/defs/media context | F | `PopupCardCreatorPrefill` carries `lookupResult` + media items verbatim (popupTypes.ts:399-439) | high |

## Scope

- **In:** mining-queue feature (entity + IDB repo + capture actions on lookup popup + CueList/cue-level capture + review UI + cardify/discard flow); count affordance; dedupe; cap; i18n en+vi.
- **Out:** auto-push to Anki on capture (queue is for deferred decision), cloud sync of queue, sharing/export of queue, mining from non-lookup surfaces (OCR region), batch-select bulk-cardify v1.
- **Non-goals:** this is not a second vocabulary — queued items are *work-in-progress sentences*, not word statuses; not a sessionRecap replacement (recap is passive stats, queue is explicit capture).

## Workflow

While watching, learner hits a line worth keeping. Today they either open the card dialog (pause, fill, save — repeat per line) or skip and lose it. With the queue: a single action — toolbar button on the lookup popup, or a cue-level action — stores a snapshot (term or plain sentence + context + source refs) to a durable queue; a subtle confirmation shows and playback never blocks. Later, from the panel, learner opens the queue, sees each saved line with context and source, and for each item either sends it to the card creator (prefill replayed), quick-adds to the configured SRS/Anki sink, or discards. Review session ends when queue is triaged; the queue badge reflects remaining items.

## Journey

### AS-IS

1. Learner watches a video; encounters a line/word worth mining.
2. Pauses (or lets it roll and forgets), opens lookup, picks term, opens card creator.
3. Waits for prefill + media fetch, edits fields, saves — ~10–30s per card.
4. Resumes playback; repeat at every interesting line — or gives up mining mid-movie.
5. Sentences skipped are gone — no trace exists of what was worth keeping.

### TO-BE

1. Learner watches a video; encounters a line worth mining.
2. Taps save (popup action or cue action) — item lands in queue with snapshot; playback uninterrupted.
3. Repeats freely — 20 lines cost 20 taps, zero dialogs.
4. After the session (any time later), opens Mining queue from the panel.
5. Reviews items top-down: cardify → dialog opens prefilled → save; or quick-add to Anki/SRS; or discard.
6. Queue empties; every saved line got a decision — nothing silently lost.

## Stories

- S1: As an immersion learner, I want to save a sentence/word in one action without opening a dialog, so that playback is never interrupted — done when a single tap/keypress persists the item and shows non-modal confirmation.
- S2: As a learner, I want my saved items to survive browser restarts, so that I can review them in a later session — done when items persist in durable storage and reappear after relaunch.
- S3: As a learner, I want to see all saved items with their sentence and source, so that I can decide what to do with each — done when the review surface lists queue items with context.
- S4: As a learner, I want to turn a queued item into a card using the normal card creator, so that I keep full editing control — done when cardify opens the creator prefilled with the captured context.
- S5: As a learner, I want to discard or quick-add items without the dialog, so that triage is fast — done when per-item discard and quick-add actions exist.
- S6: As a learner, I want duplicates prevented, so that saving the same line twice doesn't create noise — done when an identical term+sentence save is a no-op (or updates timestamp).

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Queue grows unbounded / stale items | operational | Medium — capped FIFO + count surfacing mitigates | repo cap is trivial; eviction policy in spec |
| Media URLs captured die before cardify | external | Medium — word images/audio fetched at lookup may 404 later | cardify re-resolves media via stored term/lookupResult; degraded = card without that media |
| Duplicated "save" affordances confuse vs quickAdd | human | Low — distinct icon+label, one is "save for later" vs "make card now" | design stage resolves placement |
| Subtitle cue ref stale when video changes | operational | Low — store text snapshot, not just refs | snapshot-first design |
| Scope creep into auto-mining | internal | Medium | explicit non-goal; conservative defaults |

## Decision

**go** — pain is real and externally validated (asbplayer #273, LR saved phrases), infra is largely present (self-contained prefill, IDB repo patterns, session event tap, universal panel surface), scope is M and bounded.

## Draft ACs (need-level)

- AC1: Saving from a lookup or a cue requires ≤1 user action and never opens a dialog.
- AC2: Queue persists across service-worker restart and browser relaunch.
- AC3: Review surface lists every queued item with term (if captured), sentence, source, and age.
- AC4: Cardify replays captured context into the existing card creator without data loss vs. live capture.
- AC5: Identical term+sentence saves dedupe; queue enforces a documented cap.
- AC6: All copy i18n en+vi; touch targets per `--touch-target`; works on subtitle surfaces and web-text lookups.
