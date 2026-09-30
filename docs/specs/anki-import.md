# Spec: Anki → Tihoka import

> Intent: `docs/intent/anki-import.md` · ui_surface: yes · Mode: all
> Evidence base: `docs/research/anki-to-tihoka-import-audit.md`

## Objective

Migrate an Anki user's collection into Tihoka Memory — decks (flattened),
notes, per-card schedules, review history, media — through a guided in-app
flow with two ingestion sources (live AnkiConnect, `.apkg` file), a
deck/notetype picker, and a per-notetype field-mapping preview, so that the
day after import the user's due load matches Anki's.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| User | opens import, picks source/file, selects decks/notetypes, edits field mapping, confirms/cancels | `.apkg` file, deck/notetype selection, language, field-role edits | guided checklist, picker counts, live card preview, progress, report |
| AnkiConnect (external HTTP service) | system requests | AnkiConnect actions (`deckNamesAndIds`, `findNotes`, `notesInfo`, `findCards`, `cardsInfo`, `getReviewsOfCards`, `retrieveMediaFile`) | JSON results, media base64 |

System = normalize → transform → write into SRS repositories; user behavior
never appears as a system step.

## Requirements

### Functional

REQ-1: Entry & source select
- Actor: user
- Goal: start an Anki import from Memory home
- Preconditions: Memory (srs-study) page open
- Basic flow:
  1. actor clicks import entry point (top bar, before settings)
  2. system opens import surface showing two CTAs — "Import từ Anki" (primary),
     "Import từ file .apkg" — each with a one-line pro/con
  3. system outputs the chosen source's next step
- Alt flow: primary CTA auto-pings the saved AnkiConnect URL (`cardCreator`
  settings); success → straight to picker (REQ-4) with live data.
- Exception: ping fails → inline guided checklist appears ("Anki đang mở chưa?
  / Addon AnkiConnect đã cài? / Nhập URL / Thử lại"); `.apkg` CTA stays
  available throughout.
- Rules: never ask the user to name a technology they may not know; checklist
  shown only on failure (progressive disclosure).
- Postcondition: a data source is connected/loaded
- NFR refs: NFR-1

REQ-2: Ingest via AnkiConnect (live)
- Actor: user (implicitly, via REQ-1); system calls AnkiConnect
- Goal: read the live collection into `NormalizedAnkiData`
- Preconditions: AnkiConnect reachable
- Basic flow:
  1. system queries `deckNamesAndIds`, `modelNames`, `modelFieldNames`
  2. system queries `findCards` + `cardsInfo` (chunked ≤500 ids/call),
     `findNotes` + `notesInfo` (chunked), `getReviewsOfCards` (chunked)
  3. system emits `NormalizedAnkiData` with deck list incl. per-state counts
- Alt flow: fields containing `[sound:…]`/`<img src=…>` are flagged for media
  fetch; actual bytes pulled lazily in REQ-8 via `retrieveMediaFile`.
- Exception: unreachable mid-read → surface error + retry; partial data is
  discarded (nothing written yet).
- Rules: all transport reuses the existing `CARD_CREATOR_REQUEST` background
  relay (CORS-safe) — no new transport.
- Postcondition: `NormalizedAnkiData` with fidelity note `estimated` (no
  `memory_state`/`crt` available — see REQ-7)
- NFR refs: NFR-2, NFR-3

REQ-3: Ingest via `.apkg`
- Actor: user (supplies file)
- Goal: parse the export into `NormalizedAnkiData` at full fidelity
- Preconditions: none (offline-capable)
- Basic flow:
  1. actor picks/drops `.apkg`; hint shown: enable *Include scheduling
     information* + *Include media* at export
  2. system unzips (`unzipit`), sniffs `collection.anki21b` (zstd → `fzstd`) →
     `collection.anki21` → `collection.anki2`; stub-anki2 warning text → error
  3. system reads SQLite via `sql.js`: prefers normalized
     `decks`/`notetypes`/`fields`/`templates` tables, falls back to `col.*`
     JSON; reads `cards`, `notes`, `revlog`, `media` map
  4. system emits `NormalizedAnkiData` with fidelity note `full`
- Exception: missing scheduling columns (`ivl=0` pattern, absent revlog) →
  warn "file thiếu lịch học" with choice: continue-as-new or abort; unreadable
  zip/DB → localized error.
- Rules: parsing is 100% client-side; file never leaves the device.
- Postcondition: `NormalizedAnkiData` ready for picker
- NFR refs: NFR-2, NFR-4

REQ-4: Deck & notetype picker
- Actor: user
- Goal: choose scope before import
- Preconditions: `NormalizedAnkiData` loaded
- Basic flow:
  1. system renders flat deck list (`A › B › C` for `A::B::C`) with per-state
     counts (new/learning/review; suspended shown as "sẽ không import") and a
     notetype list with note counts (cloze rows disabled + "không hỗ trợ")
  2. actor ticks/unticks; system disables Import when selection is empty
  3. system proceeds to language + mapping (REQ-5/6)
- Alt flow: "chọn tất cả / bỏ chọn tất cả" per list.
- Exception: none — pure UI state.
- Rules: filtered decks (`dyn=1`) never listed; their cards follow `odid`.
- Postcondition: `Selection { deckIds, notetypeIds }`
- NFR refs: NFR-1

REQ-5: Destination collection
- Actor: user
- Goal: choose the target language (→ language profile → collection) for the
  import
- Basic flow:
  1. system shows a language select defaulting to the active language profile
  2. actor confirms or changes; system resolves the destination:
     profile already has a collection → decks merge into it; none → a new
     `SrsCollection` is created **bound to that profile**
     (`languageProfileId` set) so Home surfaces it
- Alt flow: no active language profile exists → `ensureFirstRun` creates one
  for the chosen language first.
- Exception: none (required field, select always has a value).
- Rules: required; Anki carries no language field; never create a collection
  that Home can't render (unbound or second-on-same-profile).
- Postcondition: destination `SrsCollection` resolved (existing or new)

REQ-6: Field mapping + live preview
- Actor: user
- Goal: verify/correct how each notetype's fields become a Tihoka card
- Preconditions: selection done; sample notes loaded (≤5/notetype)
- Basic flow:
  1. system shows each selected notetype as a step: auto-guessed mapping table
     (heuristics: `ord=0`→target; `[sound:]`→audio; `<img`→image; longest-text→
     sentence/definition; name hints `ipa|kana|reading`→ipa-text)
  2. system renders a real card preview through `resolveReviewSurface` +
     back-template using the *mapped* fields
  3. actor edits a role dropdown / hits prev-next/"sample khác" → system
     re-renders from in-memory data (no re-fetch)
  4. actor confirms per notetype → final step → run
  (media note: audio/image fields referenced by the ≤5 sample notes are
  prefetched so the preview shows real media, not null-stimulus fallback;
  prefetch failure degrades to text preview silently)
- Alt flow: actor un-ticks the notetype here (skips back to picker state);
  a one-line summary ("deck: N thẻ · target=`X` · front=…") precedes confirm.
- Exception: target field empty in a sample → inline warning; none renderable
  → notetype flagged, import of it blocked.
- Rules: roles enum = `target | definition | sentence | translation | context |
  audio | image | notes | skip`; mapping persisted per notetype name
  (`chrome.storage.local` `ankiImport.mapping.<name>`) and pre-filled on
  repeat imports.
- Postcondition: confirmed `FieldMapping` per notetype
- NFR refs: NFR-1, NFR-5

REQ-7: Transform & write (the import core)
- Actor: user (confirms run); system performs
- Goal: convert `NormalizedAnkiData + Selection + FieldMapping` into Tihoka
  entities preserving schedule
- Basic flow:
  1. system resolves the destination `SrsCollection` per REQ-5 (existing
     collection → merge; new → fill `defaultStudyConfigId`/`defaultDeckId`/
     `defaultNotetypeId` from the first created rows)
  2. system creates flat `SrsDeck`s (`A::B::C`→`A › B › C`, `parentId=null`),
     each with a new `SrsStudyConfig` (`stages` default, `progressionMode:
     'parallel'`, default constants, `targetThreshold =
     round(desiredRetention*100)` when available else 90) — a deck without a
     config row silently shrinks due counts via `isLocked`
  3. system synthesizes `SrsNotetype` per selected model: fields in `ord`
     order typed by role; a mixed text+media field (`sentence [sound:x]`)
     keeps its text value AND gains a synthesized extra field
     `<fieldName>__media` typed `audio`/`image` carrying the extracted asset;
     `frontTemplates` cover all 3 components with per-component always-on
     fallbacks — meaning→definition/image else `target`-prompt, sound→audio
     else `ipa`-prompt on `target`, spelling→masked sentence/image else
     `target` (never emits a notetype where a due component can't render —
     `NO_TEMPLATE` guard)
  4. per Anki *card*: system writes one `SrsNote` + one `SrsCard` (3
     components sharing the converted FSRS state) → `recalcCard()` derives
     `nextDue`/`maintenanceMode`
  5. system writes `SrsReviewRecord`s from revlog — **all fields**: `id =
     'import-anki-<revlog.id>'` (deterministic → resume-dedup), `cardId`,
     `noteId`, `notetypeId` (of the imported card), `componentType='meaning'`,
     `templateId='imported'`, `stimulusType='definition'`, `startedAt =
     revlog.id − revlog.time`, `answeredAt = revlog.id`, `judgment` (ease
     1→forget else remember), `isStudyAgain=false`, `resultingProgress` =
     imported component progress (approximation — stats only consume
     time+judgment), `resultingFsrsState` = imported state (same caveat)
  6. system reports counts
- Alt flow: sibling cards (`ord>0`) → additional `SrsNote` clones (same
  fields). `putNote`/`putCard` throw `DUPLICATE` on (targetWord+notetypeId)
  and (noteId+deckId) — the import writer therefore writes via a dedicated
  low-level path (`importWriter.putBundle`) that validates with the Zod
  schemas but skips the uniqueness guards, because cloned siblings
  intentionally violate them.
- Exception: any card failing conversion is logged + counted, run continues;
  run is chunk-transactional and resumable (see REQ-9).
- Rules — **state/due conversion table** (authoritative):
  | Anki `queue`/`type` | `state` | due | notes |
  |---|---|---|---|
  | `queue=-1` suspended | — | — | skip card entirely |
  | `queue=-2/-3` buried | = `type` | per `type` | drop flag |
  | `type=0` new | 0 | `now` | enters explore pool |
  | `queue=1` learning | 1 | `due` = unix s | |
  | `queue=3` day-learn | = `type` (1 or 3) | `crt + due` days (apkg) **or**
    `now` on Connect (no `crt` — flagged estimated) | |
  | `queue=2` review | 2 | `crt + due` days (apkg) **or** `lastRevlog.id + ivl` (Connect) | |
  - `fsrsState`: `state` as mapped; `due` ISO; `reps`/`lapses` copied;
    `scheduledDays=elapsedDays=max(ivl,0)`; `learningSteps =
    floor(left/1000)` for learning states else 0 (approximation — Anki packs
    `left = steps*1000 + todayReps`; new-card position order is dropped,
    accepted — the new pool shuffles anyway); `lastReview` = card's last
    revlog id (else `due−ivl`).
  - `stability`/`difficulty`: decode `memory_state` (protobuf fixed32 fields
    1–2 via `DataView`, no proto lib) when present (apkg); else estimate —
    `stability=max(ivl,1)`, `difficulty=clamp(1,10,round(11−factor/300))`.
  - `progress`: `clamp(0,100, round(100·R/DR))` with `R` = ts-fsrs
    `forgetting_curve(elapsed,stability)` and `DR` = deck desired retention
    (default 0.9); learning-state cards get `progress=20`;
    `exploreCount=0` for `type=0` else `minExplores`.
  - dedup: `SrsCard`/`SrsNote` get optional `importSource` field
    `{provider:'anki', cardId, noteId}` (Zod `.optional()` — backward
    compatible, no IDB version bump). Lookup builds one in-memory
    `Map<cardId→true>` per run by scanning target-collection cards once —
    no new index needed. Review records dedup via deterministic id
    (`import-anki-<revlogId>`).
  - atomic unit = **per-card bundle** (note + card + its review records +
    media asset puts) committed together — a cancel between bundles never
    orphans a card without its records.
  - all writes flow through `srsSyncScope`/capture — imported entities sync
    to Drive like user-created data (intended).
  - cards whose deck is filtered (`dyn=1`): home deck = `odid`; `odid=0` →
    nearest non-filtered ancestor of `did`; none → count as skipped.
- Postcondition: collection + decks + notetypes + notes + cards + records
  persisted; report data collected
- NFR refs: NFR-2, NFR-4, NFR-6

REQ-8: Media import
- Actor: none direct (system)
- Goal: `[sound:x]`/`<img src=x>` payloads become stored assets
- Basic flow: for each mapped audio/image field value, system resolves media
  filename → bytes (apkg: zip entry via `media` map; Connect:
  `retrieveMediaFile`) → `audioAssetRepository`/`imageAssetRepository`
  (`source:'local'`) → field value rewritten to `{kind:'audio'|'image'}`.
- Exception: missing media file → keep original text markup, count as miss.
- Rules: media dedupe by asset id (hash noteId+fieldId+source).
- NFR refs: NFR-2

REQ-9: Progress, cancel, resume
- Actor: user
- Goal: watch and control a long import
- Basic flow: staged progress ("reading decks/notes/cards/media/writing") +
  percentage + cancel; the atomic unit is the per-card bundle (REQ-7) —
  a cancel checkpoints between bundles.
- Exception: AnkiConnect drop mid-run → committed bundles stay; retry dedups
  via `importSource` + deterministic record ids.
- NFR refs: NFR-3, NFR-6

REQ-9b: Quota pre-flight
- Actor: none direct (system)
- Goal: refuse/warn before media blows IDB quota
- Basic flow: before REQ-7 runs, system estimates total media bytes (apkg:
  zip entry sizes; Connect: per-file `retrieveMediaFile` HEAD-ish /
  accumulated size cap) + existing usage via `quotaManager`; over quota →
  warn with "continue without media" / abort choice.
- NFR refs: NFR-6

REQ-10: Import report
- Actor: user
- Goal: know exactly what happened
- Basic flow: final screen lists imported cards, skipped-suspended,
  skipped-cloze, media hits/misses, fidelity note (`full` vs `estimated` —
  Connect path), and "Học ngay" CTA.
- NFR refs: NFR-1

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Guided, i18n'd, a11y surface (per AGENTS persona 5–80, <3s feedback) | U | all copy via `t()`, focus trap, keyboard-complete |
| NFR-2 | No data leaves the device; apkg parsed locally; media into IDB | +privacy/security | 0 network calls on file path |
| NFR-3 | AnkiConnect calls chunked (≤500 ids) and cancellable | P / R | responsive UI during 10k-card imports |
| NFR-4 | `fzstd` (or equivalent) added only if needed for anki21b — lazy-loaded | +infra | bundle impact reviewed before merge |
| NFR-5 | Field-mapping guess accuracy: ≥80% fields correct on standard models (Basic, Basic&Reversed, mined JP decks) | U | measured on fixture decks |
| NFR-6 | Idempotent & resumable writes; no half-written collection on abort | R | batch transactions + `importSource` dedup |

## Flows / States

Import run state machine:

```
idle --open→ sourceSelect
sourceSelect --connectOk|fileParsed→ picking
sourceSelect --connectFail→ guidedChecklist --retryOk→ picking
sourceSelect|picking|mapping|guidedChecklist --close→ idle
picking --confirm→ languaging → mapping
mapping --back→ picking ; mapping --confirm→ importing
importing --done→ reported ; importing --cancel/error→ reported(partial)
reported --studyNow|close→ closed
```

`mapping` iterates per selected notetype; `guidedChecklist` never blocks the
`.apkg` branch.

## Function ↔ Feature Map

| Function | Features |
|---|---|
| Read an Anki collection | `ApkgAdapter` (unzip/zstd/sql.js), `AnkiConnectAdapter` (chunked actions over `CARD_CREATOR_REQUEST`) |
| Let user scope the import | Deck/notetype picker surface with per-state counts |
| Convert fields correctly | Mapping heuristics, editable role table, live card preview, persisted mapping presets |
| Preserve scheduling | State/due conversion table, `memory_state` decoder, SM-2 fallback estimator, `recalcCard` |
| Write safely | `importNormalized()` batch writer, `importSource` dedup, transactional batches |
| Keep streaks honest | revlog→`SrsReviewRecord` mapper |
| Communicate outcome | Staged progress + cancel, final report, fidelity note |
| Surface the feature | Top-bar import button (`srs.home.importAnki`, new `import` icon via design-svg) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `NormalizedAnkiData` (transient) | decks, notetypes, notes, cards, revlog, media map | memory | dies with run |
| `SrsCollection`/`SrsDeck` | flat names `A › B › C`; `targetThreshold` from DR | SRS IDB | persistent |
| `SrsNotetype` (synthesized) | fields typed by role; fallback `frontTemplates` | SRS IDB | persistent |
| `SrsNote`/`SrsCard` | `importSource:{provider:'anki',cardId,noteId}` (schema extension) | SRS IDB | persistent |
| `SrsReviewRecord` | judgment from ease; `templateId='imported'` | SRS IDB | persistent |
| `SrsAudioAsset`/`SrsImageAsset` | source `'local'`, bytes | SRS IDB | persistent |
| Mapping presets | `ankiImport.mapping.<notetypeName>` | `chrome.storage.local` | persistent |

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 schedule fidelity | REQ-7 | AC-1, AC-8 |
| N2 content+media | REQ-8, REQ-7.4 | AC-6 |
| N3 dual sources | REQ-1/2/3 | AC-2, AC-3 |
| N4 choose decks/notetypes | REQ-4 | AC-4 |
| N5 preview+remap | REQ-6 | AC-5 |
| N6 flatten subdecks | REQ-7.2 | AC-4 |
| N7 suspended deleted | REQ-7 (table) | AC-4 |
| N8 revlog | REQ-7.5 | AC-7 |
| N9 cloze unsupported | REQ-4 | AC-4 |
| N10 re-import dedup | REQ-7 rules | AC-6 |
| N11 no half-write | REQ-7/9 | AC-6 |
| N12 discoverable entry | REQ-1 | AC-9 |
| N13 guided fallback | REQ-1 alt | AC-2 |
| N14 clear report | REQ-10 | AC-10 |
| N15 mapping persisted | REQ-6 rules | AC-5 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1 open + choose source | REQ-1 |
| 2 pick + language + preview | REQ-4/5/6 |
| 3 progress + report | REQ-9/10 |
| 4 parity next day | REQ-7 (gates) |
| edge: checklist/fallback, missing scheduling, dedup | REQ-1 alt, REQ-3 exc, REQ-7 |

## Boundaries

- Always: transform logic is pure/testable; side effects isolated to
  repositories; every new UI text i18n'd; Menu/Dialog primitives reused.
- Ask first: new dependency (`fzstd` for anki21b — flag in review before
  merge); `manifest.json` unchanged (none needed).
- Never: send user data off-device; write to SRS stores without Zod
  validation; bypass `recalcCard` for derived card fields.

## Success Criteria

- [ ] AC-1: `.apkg` (FSRS) import → imported cards' `state`, `reps`,
  `lapses`, `due` (day precision) match source; `stability`/`difficulty` equal
  decoded `memory_state`.
- [ ] AC-2: AnkiConnect path completes end-to-end on a live collection;
  unreachable → guided checklist + retry works; `.apkg` CTA never blocked.
- [ ] AC-3: anki21b (zstd) and anki2 apkg files both parse; stub-anki2 gives
  a clear error.
- [ ] AC-4: picker flattens `A::B::C`→`A › B › C`; suspended excluded +
  counted; cloze disabled + counted; filtered decks not listed, cards routed
  via `odid`.
- [ ] AC-5: editing a field role re-renders preview without re-fetching;
  mapping persists across runs for the same notetype name.
- [ ] AC-6: re-import of same source reports "already imported", no
  duplicates; cancel mid-run leaves consistent state; missing media counted
  as miss with original markup kept.
- [ ] AC-7: imported revlog rows appear as review records; streak/stats
  reflect them.
- [ ] AC-8: due-count parity — baseline = raw eligible count in the source
  (`cards` with `queue ∈ {0,1,2,3}`, selected decks, effective due ≤ today;
  NOT Anki's capped display) vs Tihoka cards with `nextDue ≤ today` in the
  imported decks — must be equal; mature cards (R≥DR) land in
  satisfied/maintenance.
- [ ] AC-9: import button visible in Memory top bar before settings, with
  accessible name.
- [ ] AC-10: report enumerates imported / suspended-skipped / cloze-skipped /
  media hits-misses / fidelity note; "Học ngay" starts a session.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI pass per design-system-guardian; before/after evidence for new surfaces
- [ ] Real-deck fixture test: due-parity + no NO_TEMPLATE on imported notetypes
- [ ] Canon docs: `2-architechture-system.md` (import feature), `0-wiki.md`,
  ADR if schema extension (`importSource`) or new dep lands

## Open Questions / Accepted Risks

- `progress` formula constants validated against fixture decks (all-mode
  conservative choice recorded in REQ-7).
- Preview/mapping sheet host (Dialog vs MobileSheet on small screens) —
  DESIGN stage decides.
- AnkiConnect `cardsInfo` fidelity: confirmed no `memory_state` — report
  discloses "estimated"; apkg remains the fidelity path.
- `fzstd` dependency addition — gated per Boundaries.
- One-shot migration only — no ongoing Anki sync (restated non-goal).
- Verify at build: `cardsInfo` exposes `odid`/`ord` on the Connect path
  (documented actions list them; confirm on a live AnkiConnect before
  finalizing REQ-4 filtered-deck routing).
- Imported writes emit sync captures to Drive — intended behavior, but
  first sync after a large import will be big (accepted).
