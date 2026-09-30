# Audit: Anki → Tihoka SRS import

Goal: migrate an Anki user's in-progress collection into Tihoka's built-in SRS
("Ocean SRS") preserving schedule + card states, flattening subdecks into flat decks.

Audit date: 2026-09-30. Sources: `src/entities/srs/types.ts`,
`src/features/srs/logic/*`, `docs/specs/ocean-language-acquisition-srs.md`,
Anki `schema11.sql` (rslib), Anki 2.1.50+ apkg layout, `proto/anki/scheduler.proto`.

---

## 1. The `.apkg` container

`.apkg` is a ZIP (unzip: `unzipit` is already a dep; `fflate` also available)
containing:

| Entry | Meaning |
|---|---|
| `collection.anki2` | SQLite v11 schema (old exports) or a stub DB saying "update Anki" |
| `collection.anki21` | SQLite, same table layout, uncompressed |
| `collection.anki21b` | SQLite compressed with **Zstandard** (written when user exports without legacy compat) |
| `media` | JSON map `"<index>" → "<original filename>"` |
| `0`, `1`, `2`, … | Media payload files (numeric names matching `media` keys) |

Importer must sniff which collection file exists; `anki21b` needs zstd
decompression before SQLite — verified `fflate@0.8.3` has **no zstd** support,
so anki21b needs a new dep (`fzstd`/`@bokuweb/zstd-wasm`) or the "export with
legacy compat" fallback path. `sql.js` is already a dependency
(`features/dictionary/strategies/sqliteStrategy.ts`) — reuse its loader.

Schema note: newer Anki DBs normalize `decks`/`notetypes`/`fields`/`templates`
out of `col.*` JSON columns into real tables. Importer should prefer the
normalized tables and fall back to `col.decks` / `col.models` JSON.

## 2. Anki data model (relevant columns)

**col**: `crt` (collection creation, unix seconds — the day-number epoch for
`due`), `conf`, `decks`, `models`, `dconf`.

**notes**: `id, guid, mid, tags (space-separated), flds (\x1f-joined), sfld`.

**cards**: `id, nid, did, ord, mod, type, queue, due, ivl, factor, reps,
lapses, left, odue, odid, flags, data` + FSRS-era columns
`memory_state (BLOB protobuf), desired_retention, decay`.

- `type`: 0 new · 1 learning · 2 review · 3 relearning.
- `queue`: −3 user-buried · −2 sched-buried · −1 suspended · 0 new · 1 learn ·
  2 review · 3 day-learn/relearn.
- `due` semantics — **this is the trap**, it is NOT one unit:
  - new (`type=0`): position counter, not a date.
  - learning (`queue=1`): **unix timestamp (seconds)**.
  - day-learn (`queue=3`) & review (`queue=2`): **days since `col.crt`** →
    absolute due = `crt*1000 + due*86400000`.
- `ivl`: interval in days (review) or negative seconds (learning).
- `factor`: SM-2 ease ‰ (e.g. 2500 = 250%). 0 when FSRS-scheduled.
- `left`: packed remaining learning reps `= stepsLeft*1000 + todayRepsLeft`.
- `odid`/`odue`: original deck/due while inside a filtered deck (`dyn`).
- `memory_state`: protobuf `FsrsMemoryState { stability: f32 (field 1),
  difficulty: f32 (field 2) }` — only two fixed32 fields, trivially decodable
  with `DataView`, no protobuf runtime needed. Present only for FSRS-scheduled
  cards (Anki ≥ 23.10).

**revlog**: `id (ms epoch), cid, ease (1..4), ivl, lastIvl, factor, time, type
(0 learn,1 review,2 relearn,3 cram)`.

**decks** (v11 `col.decks` JSON or normalized table): `{ id, name, conf,
dyn, usn, mod, desc }`. Hierarchy encoded **in the name** with `::`
(`"Languages::Japanese::Core2k"`). `dyn=1` = filtered deck.

**models/notetypes**: `{ id, name, flds: [{name,ord}], tmpls, css }` — cloze
models flagged via `type` field.

## 3. Tihoka data model (SSOT: `entities/srs/types.ts`)

- `SrsCollection` → `SrsDeck` (has `parentId`, but import flattens anyway) →
  `SrsNote` (`targetWord` unique per notetype via `getNoteByTargetAndNotetype`)
  → `SrsCard` (1 card per note per deck).
- **Card = 3 fixed memory components** `meaning | sound | spelling`, each with
  own `fsrsState` (a ts-fsrs `Card`), `progress` 0–100, `exploreCount`,
  `reviewCount`. `studyAgainDue`, `nextDue`, `maintenanceMode` are derived via
  `recalcCard()`.
- `SrsFsrsSerializedState` = ts-fsrs card: `due(ISO), stability, difficulty,
  elapsedDays, scheduledDays, reps, lapses, learningSteps, state, lastReview`.
  `state` enum: 0 New · 1 Learning · 2 Review · 3 Relearning — **identical
  numbering to Anki `type`**.
- `SrsNotetype`: typed fields (`text|audio|image|list|translation|context`),
  `frontTemplates` per componentType, `targetFieldId`.
- Scheduler (`selectNextReview` → `resolvePool`) classifies components into
  `explore | studyAgain | active | satisfied | maintenance`. **Constraint: when
  a due component wins the pick but no template renders it, `SrsError('NO_TEMPLATE')`
  is thrown** (`selectNextReview.ts:106`) — winner-only check, but any
  un-renderable due component can crash the session when picked. Imported
  notetypes therefore need fallback templates so all 3 components always render.

## 4. Similarities vs differences

| Aspect | Anki | Tihoka | Consequence |
|---|---|---|---|
| Card state enum | type 0–3 (new/learn/rev/relearn) | ts-fsrs `state` 0–3, same order | Direct copy |
| Memory model | SM-2 (`ivl,factor`) **or** FSRS (`memory_state`) | ts-fsrs only (`stability,difficulty`) | FSRS→direct; SM-2→approximate |
| Scheduling unit | one card = one schedule | one card = **3 component schedules** | Fan-out one Anki state → 3 components |
| Note→card | 1 note → N cards (`ord`) | 1 note → 1 card per deck | Each Anki *card* → own Tihoka note+card |
| Deck tree | `::` in name | `parentId` exists but we flatten | Flat deck, name = full path |
| Deck options | `dconf` incl. `desiredRetention` (FSRS) | `SrsStudyConfig.targetThreshold` (0–100) | `targetThreshold = round(DR*100)` |
| Acquisition | none (binary recall) | `progress` 0–100 + `exploreCount` gates pools | Must be derived — see §5 |
| Suspended | `queue=-1` | no equivalent | Tag + far-future due |
| Buried | `queue=-2/-3` (day-scoped) | no equivalent | Ignore, import underlying `type` |
| Filtered deck | `dyn=1`, `odid` real home | no equivalent | Route card to `odid` |
| History | `revlog` | `SrsReviewRecord` (feeds streaks/stats) | Importable, judgment-mapped |
| Media | zip entries `[sound:x]`, `<img>` | `SrsAudioAsset`/`SrsImageAsset` IDB blobs | Extract → cache → rewrite field kinds |
| Templates | HTML/CSS card templates | typed `frontTemplates`/`backTemplate` | Cannot port — synthesize defaults |
| FSRS params | per-preset weights + decay | ts-fsrs `fsrs()` default weights | Not portable — accept defaults |

## 5. Recommended mapping

### Collection
- One `.apkg` → one `SrsCollection` (name = filename or user-picked). Let the
  user pick `targetLanguage` at import time (Anki has no language field).

### Decks (flatten rule)
- Each Anki deck id → one `SrsDeck`, `parentId: null`, `name` = full path with
  `::` → `›` (keeps context, avoids leaf-name collisions). Skip `dyn=1`
  filtered decks; cards inside them go to their `odid` deck (or the filter
  deck's closest non-filtered ancestor if `odid=0`).
- `dconf.desiredRetention` → deck's `SrsStudyConfig.targetThreshold`
  (`round(DR*100)`, clamp 50–97, default 90).

### Notetypes
- Each Anki model → `SrsNotetype`: fields in `ord` order, `type` inferred per
  field by scanning note values (`[sound:…]`→audio, `<img`→image, else text);
  `targetFieldId` = field 0; `targetWord` = `sfld` (HTML stripped).
- `frontTemplates`: synthesize per component using available fields:
  - meaning → `definition`(first text field after target) then `sentence`-like
    text field then image field.
  - sound → audio field, else `ipa`-prompt fallback on `target` (mirrors the
    default notetype's pronounce fallback — guarantees renderability).
  - spelling → image/sentence/definition field with `requiresInput`, plus
    `target`-based fallback.
- Cloze models: keep `Text`/`Extra` as text fields; strip `{{cN::…::hint}}`
  keeping the answer for `targetWord`/displayed text (importer does the
  stripping — do not store raw cloze markup).

### Notes & cards — one Anki *card* → one Tihoka note + card
- `ord=0` card keeps the canonical note; for `ord>0` siblings create an
  additional `SrsNote` with identical fields (insert via `putNote` directly —
  bypass the `targetWord`-dedup in `addNoteAndCard`, which would merge them).
  Rationale: each Anki card has its own schedule; folding siblings into one
  component-set would destroy per-card state.
- Alternative considered & rejected: one note per Anki note, extra cards'
  schedules dropped — violates the "schedule preserved" requirement.

### Component state (per component, same value ×3)
- `exploreCount = 0, progress = 0` when `type=0` (new) → enters `explore` pool,
  fresh content introduction preserved.
- Otherwise `exploreCount = config.minExplores` (skip re-introduction).
- `fsrsState`:
  - `state` = Anki `type` (0–3 direct).
  - `due` = ISO from the §2 unit rules; new cards → `now` (immediately due →
    explore pool anyway).
  - `stability`, `difficulty`: decode `memory_state` when present.
    SM-2 fallback: `stability = max(ivl, 1)` (days);
    `difficulty = clamp(1, 10, round(11 − factor/300))` (ease 2500→≈5, 1300→≈8).
  - `elapsedDays = scheduledDays = max(ivl,0)`; `reps`, `lapses` direct;
    `learningSteps = left % 1000` for learning states else 0;
    `lastReview` = `revlog` last `id` for the card, else `due − ivl`.
- `progress`: retrievability-scaled so pool semantics survive:
  `R = forgetting_curve(elapsed_days_since_last_review, stability)` (ts-fsrs
  already exposes this), `progress = clamp(0, 100, round(100 * R / DR))`.
  Cards still retrievable (`R ≥ DR`) land at ≥ `targetThreshold` →
  `satisfied`/`maintenance`; overdue-but-learned cards stay in `active` with
  proportionally lower progress. Learning-state cards: `progress = 20`.
- `studyAgainDue = null ×3`; build the card raw then run `recalcCard()` —
  `nextDue`/`maintenanceMode` derive themselves.
- **Suspended** (`queue=-1`): ~~import + tag~~ → **superseded by §6 — skipped
  (deleted) per decision**.
- **Buried** (`queue=-2/-3`): treat by `type`/`due` normally (burial is
  day-scoped in Anki and dies at midnight anyway).

### Revlog → `SrsReviewRecord`
- Map `ease: 1→'forget', 2|3|4→'remember'`; `answeredAt = id`,
  `componentType='meaning'`, `templateId='imported'`, `stimulusType='text'`,
  `resultingFsrsState` = minimal synthesized state at that point.
- Worth it: keeps streaks/`wordsPerDay` stats continuous — cheap rows, same
  repository.

### Media
- `media` JSON → filename map; extract referenced `[sound:x]`/`<img src>` from
  field values, store bytes into `audioAssetRepository`/`imageAssetRepository`
  (`source: 'local'`), rewrite the field to `{kind:'audio'|'image'}`.
- Fields with mixed text+media markup: keep text field (HTML retained for
  display) **and** add the extracted media as a separate field-value entry.

## 6. Confirmed decisions (2026-09-30 brainstorm)

- **Two sources, one transform core**: `ApkgAdapter` (zip → sniff
  anki2/anki21/anki21b → sql.js, full FSRS fidelity) and `AnkiConnectAdapter`
  (live `deckNamesAndIds`/`findNotes`/`notesInfo`/`findCards`/`cardsInfo`/
  `getReviewsOfCards`/`retrieveMediaFile`, chunked ~500 ids/call, reuses the
  existing `CARD_CREATOR_REQUEST` background transport + saved AnkiConnect
  URL). Both emit a shared `NormalizedAnkiData` → single `importNormalized()`
  pipeline.
- **AnkiConnect gaps handled**: no `col.crt` action → absolute review due =
  `lastRevlog.id + ivl days`; `memory_state` not exposed → SM-2 fallback
  approximation, reported as "estimated" in the import report.
- **Entry UX (hybrid progressive disclosure)**: no upfront path question.
  Import entry shows two CTAs — primary "Import từ Anki" (auto-pings the saved
  AnkiConnect URL; on failure expands an inline guided checklist "Anki mở chưa?
  / AnkiConnect cài chưa? / Thử lại", apkg stays as escape hatch) and secondary
  "Import từ file .apkg" (hint: enable *Include scheduling* + *Include media*).
  One-line pros/cons under each CTA.
- **Entry placement**: top bar of `SrsHome`, before the settings gear —
  `Button ghost sm circle chromeButton`, `aria-label` `srs.home.importAnki`.
  New `import` icon via `design-svg` (not in `ICON_CATALOG` yet).
- **Picker step** (both paths): flat deck list (`A › B › C`) with per-state
  card counts + notetype list with note counts; cloze notetypes shown disabled
  "không hỗ trợ"; suspended counts shown as "sẽ không import".
- **Language prompt**: user picks `targetLanguage` for the new collection
  (Anki has no language field); defaults to current language profile.
- **Preview & mapping step** (between picker and import): per-notetype field
  mapping table auto-guessed by heuristics (`[sound:]`→audio, `<img>`→image,
  field 0→target, long text→sentence); per-field role dropdown incl. "không
  import"; live card preview rendered through the **real**
  `resolveReviewSurface` + back-template pipeline on sample notes
  (prev/next + "different sample"); user can back out to the picker; notetype
  can be un-ticked here; a one-line summary ("Core2k: 2,134 thẻ ·
  target=`Expression` · front=audio+sentence") before the run; mapping choices
  persisted per notetype name for repeat imports.
- **Suspended**: **deleted** — card skipped entirely (note still imported if
  it has non-suspended siblings; note skipped when all its cards suspended),
  counted in the report.
- **Buried**: flag dropped, imported by `type`.
- **Revlog**: imported → `SrsReviewRecord` (`ease 1→forget`, `2|3|4→remember`,
  `componentType='meaning'`, `templateId='imported'`) for streak continuity.
- **Cloze**: not supported — picker-disabled, counted as skipped.
- **Subdecks**: flattened, `name = "A › B › C"`, `parentId=null`.
- **Re-import dedup**: store source `ankiCardId` on the card → re-running an
  import reports "already imported" instead of duplicating.
- **Partial failure**: import is transactional/resumable per card batch —
  mid-run AnkiConnect drop must not leave a half-written deck.
- **Verify gates**: `dueCount(today)` Tihoka == Anki "Due" count pre-export;
  mature cards must land in satisfied/maintenance, not active.

## 7. User journey skeleton

Entry → [Connect auto-check | apkg file pick] → picker (decks/notetypes)
→ language → **preview+mapping** (per notetype, live, back-able) → import
with staged progress + cancel → report (imported/skipped-suspended/
skipped-cloze/media hits, fidelity note for Connect path) → "Học ngay".

Edge cases covered: export without scheduling (warn + offer "import as new"),
empty selection (disable Import), cloze-only notes, mid-run disconnect,
re-import dedup, media-in-text markup.

## 8. Pipeline shape

```
.apkg → unzip → sniff collection.anki2/21/21b (+zstd) → sql.js
      → read col/decks/models/notes/cards/revlog
      → build SrsCollection + flat SrsDecks + SrsNotetypes
      → per card: note(fields+media) + SrsCard(×3 components) + recalcCard
      → revlog → reviewRecords
      → single IDB transaction batch + import report
        (imported/suspended/skipped-filtered counts)
```

Report to user: N cards imported, M suspended, K filtered-deck reroutes,
notes-per-card duplications, media hits/misses.

## 9. Non-goals / accepted losses

- Custom FSRS weights, `desiredRetention` per-preset beyond threshold,
  custom HTML/CSS card templates, leech flag → carry as tags (`leech` → tag,
  optional).
- Exact `learningSteps`/`left` intra-day granularity — approximated.
- AnkiConnect path loses FSRS `memory_state` precision (falls back to
  ivl/factor approximation) — accepted; `.apkg` remains the high-fidelity path.

## 10. Open decisions for spec stage

1. `progress` formula constants (§5) — verify against real decks in tests.
2. Persistence of per-notetype mapping: shape + where it lives
   (`chrome.storage.local` keyed by notetype name).
3. Exact picker/preview sheet host — `Dialog` vs `MobileSheet` (mobile
   persona) — resolve in design stage.
4. AnkiConnect `getReviewsOfCards` chunk size + total timeout policy for
   10k-card decks.
