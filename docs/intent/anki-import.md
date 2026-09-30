# Intent: Anki → Tihoka import (cards + schedules)

> Slug: `anki-import` · Mode: all · Source: user statement (2026-09-30 brainstorm)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Anki users who adopt Tihoka Memory lose months of accumulated review schedule if they cannot bring their in-progress decks; the knowledge investment (stability, due dates, lapses) is the lock-in, not the card text | `docs/research/anki-to-tihoka-import-audit.md` §4–5; user statement "chuyển đổi người dùng từ anki sang tihoka" | high |
| Change | Today: Tihoka SRS only accepts brand-new notes via popup/card-creator (`SRS_ADD_NOTE` → `addNoteAndCard` creates empty FSRS cards, `cardCreation.ts:52`). Future: a user can point Tihoka at a running Anki (AnkiConnect) or an `.apkg` and get their decks, notes, cards, schedules, and review history imported with state fidelity | audit §5–6; `src/entities/srs/types.ts:133` (SrsCard has 3 FSRS components); `src/features/dictionaryPopup/services/addToOceanSrs.ts` (only creation path today) | high |
| Solution | A guided import flow inside Memory: auto-detect AnkiConnect (progressive-disclosure checklist only on failure) or `.apkg` file; pick decks/notetypes; preview + remap fields per notetype; import preserves type/queue/due/reps/lapses/history, flattens subdecks, skips suspended/cloze | confirmed decisions, audit §6 | high |
| Value | Removes the #1 switching cost for Anki migrants; converts Tihoka Memory from "start over" to "continue studying" — directly enlarges the addressable user base for the card-creator + SRS flywheel | user goal; market reality of Anki lock-in `[assumption]` | medium |
| Stakeholder | Anki user migrating to Tihoka (5–80, low-tech to power users); secondary: existing Tihoka users who already have AnkiConnect configured | AGENTS persona; `cardCreator.settings.ankiUrl` flow exists | high |
| Context | MV3 extension, IndexedDB storage, sql.js already a dependency (`package.json`), ts-fsrs 5.4.2 with state enum identical to Anki `type`, AnkiConnect client + background transport already exist (`ankiConnectClient.ts`, `CARD_CREATOR_REQUEST` handler) | audit §1–4; `docs/2-architechture-system.md` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Cell maintainers/agents | Buildable with existing deps (sql.js, ts-fsrs, AnkiConnect client); needs zstd decode for anki21b (fflate already used for gzip — check zstd support) | Must not destabilize SRS store; deep-import rules apply |
| Customer | Migrating Anki user (low-tech Mai; power-user Hùng) | Keep schedule + card content + media; do not lose data silently; preview before committing | May not know what export/AnkiConnect is — guided flow required |
| Supplier/Dependency | Anki desktop (AnkiConnect addon), `.apkg` files, AnkiDroid apkg export | Stable, documented formats/APIs | AnkiConnect does not expose `memory_state` or `col.crt` — approximation accepted |
| Organization | Tihoka product direction | Positions Memory as Anki successor, not companion | none — aligns |
| Regulator | none — local-first, user's own data | none | Reading user's own Anki DB/file is their data; no compliance issue |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Import card scheduling state (due, type/state, reps, lapses, interval) so that day-1 after import shows the same due count as Anki | F / R | audit §6 "Verify gates"; user: "lịch học, states phải được import đầy đủ" | high |
| N2 | Import note content incl. media (audio/images inside `[sound:]`/`<img>`) so cards display correctly | F | audit §5 media | high |
| N3 | Import must work for low-skill users (no manual file export) **and** offer a full-fidelity path — user-issued constraint realized as AnkiConnect + `.apkg` sources (confirmed decision) | F / U | user decision 2026-09-30; audit §6 | high |
| N4 | User chooses which decks + notetypes to import before running | F / U | user: "phải hỏi user xem cần import deck, notetype nào" | high |
| N5 | Field-mapping preview per notetype with editable roles, re-rendered live, so wrong mappings are caught before import | U | user: "phải có preview… quay lại chỉnh trường mapping" | high |
| N6 | Flatten subdecks (`A::B::C` → flat deck `A › B › C`) | F | user: "làm phẳng thành deck" | high |
| N7 | Suspended cards are excluded (deleted at source-selection), counted in report | F | user: "những thẻ suspend sẽ bị xóa" | high |
| N8 | Review history imported (revlog → review records) for streak/stats continuity | F | user: "có import revlog" | high |
| N9 | Cloze notetypes unsupported — visibly disabled in picker, counted as skipped | F / S | user: "không hỗ trợ cloze notetype" | high |
| N10 | Re-import must not duplicate (dedup by Anki card id) | R | audit §6; `[assumption]` real-user re-runs | medium |
| N11 | Mid-run failure must not leave a half-written collection | R | audit §6 partial failure | high |
| N12 | User can discover and start the import from the Memory home screen (confirmed decision: icon button in top bar before settings) | U | user screenshot + placement decision | high |
| N13 | Guided fallback when AnkiConnect unreachable (Anki closed / addon missing) with retry; apkg always available | U | progressive-disclosure decision 2026-09-30 | high |
| N14 | Clear import report (imported / suspended-skipped / cloze-skipped / media hits / fidelity note) | U | audit §6 report | high |
| N15 | Preserved per-notetype mapping for repeat imports | U | audit §6 | medium |

## Scope

- **In:** AnkiConnect live import; `.apkg` (anki2/anki21/anki21b incl. zstd); deck+notetype picker; per-notetype field mapping + live preview; deck flattening; full card-state mapping into 3-component Tihoka cards; revlog import; media extraction; import report; re-import dedup; cancellation.
- **Out:** Cloze notetypes; suspended cards (skipped, not imported); Anki→Tihoka *sync* (one-shot only); editing imported notetype templates post-import beyond V1 defaults; exporting Tihoka→Anki.
- **Non-goals:** two-way sync with Anki; preserving custom FSRS weights/card HTML+CSS templates; preserving buried state; importing filtered decks as decks; AnkiConnect push (already exists for card creation).

## Workflow

Narrative: the user opens Memory and clicks the new import icon in the top bar. The dialog offers "Import từ Anki" (primary) and "Import từ file .apkg". On the primary path Tihoka silently pings the stored AnkiConnect URL; on success it goes straight to the picker, on failure an inline checklist appears ("Anki đang mở? / AnkiConnect đã cài? / Thử lại") with the .apkg CTA always visible as escape. On the file path the user picks an `.apkg` (export instructions shown), the file is parsed locally (sql.js; zstd when anki21b) into the same normalized shape. Both paths converge on a picker listing flattened decks with per-state card counts and notetypes with note counts (cloze disabled). Next the user sets the collection's target language, then reviews each notetype's auto-guessed field mapping against a live-rendered sample card — adjusting role dropdowns re-renders instantly; they may back out or un-tick a notetype here. Confirming runs the staged import (progress + cancel; chunked writes). The report lists imported/skipped-suspended/skipped-cloze/media counts and, on the Connect path, a fidelity note. From the report the user can start studying immediately. System↔system: AnkiConnect transport reuses `CARD_CREATOR_REQUEST` via the background SW. Person↔device: picker/mapping/preview/report surfaces; no person↔person step.

## Journey

### AS-IS

1. An Anki user installs Tihoka, opens Memory, sees only an empty "Default" deck; their Anki collection (decks, months of review history) lives in another app.
2. To get content into Tihoka they must create cards one-by-one via popup Quick Add / Card Creator (`SRS_ADD_NOTE`), which always creates *new* FSRS cards with empty state (`cardCreation.ts`, `createCard`).
3. Their Anki review schedule is invisible to Tihoka; to keep learning streaks they must keep Anki installed and review there — or abandon the schedule and restart every card as new.
4. Result: most stay on Anki; Tihoka Memory adoption stalls among exactly the users most ready for it.

### TO-BE

1. User opens Memory, clicks the import icon (top bar, next to settings), chooses "Import từ Anki"; Tihoka auto-connects (or shows a guided fix + retry), or the user drops in an `.apkg`.
2. User ticks the decks and notetypes they want, picks the collection language, then previews a real rendered card per notetype — the `Expression` field is mapped to target, `Meaning` to definition, `Audio` to word audio; they fix a wrong guess in one dropdown and see the preview update; they un-tick a broken cloze type (already disabled) — then confirm.
3. Progress runs ("Đang đọc 472 thẻ… đang tải 89 media…"), finishes with a report: imported count, suspended skipped, cloze skipped, media hits; FSRS fidelity noted.
4. Next morning the deck shows the same due count Anki showed; mature cards sit in maintenance; streaks continue because revlog was imported; the user uninstalls Anki.

Edge cases (inside step 2–3): no AnkiConnect → guided checklist → retry or apkg fallback; export missing scheduling → warning + "import as new" choice; connection drops mid-run → partial import is resumable/dedup-safe on retry; re-running the same import reports "already imported".

## Stories

- S1: As a migrating user, I want to import selected Anki decks with their schedules so that my review load continues uninterrupted — done when due counts match Anki's pre-import numbers.
- S2: As a migrating user, I want to preview how each note type's fields map to a card so that I can fix mapping before committing — done when mapping edits re-render the preview without re-fetching.
- S3: As a low-skill user, I want to import without learning what an .apkg is so that one button is enough — done when AnkiConnect path completes end-to-end after granting the addon.
- S4: As a power user, I want FSRS stability/difficulty preserved exactly so that intervals are identical — done when an apkg with `memory_state` imports cards whose ts-fsrs state matches Anki's.
- S5: As a user with messy collections, I want suspended and cloze cards excluded transparently so that I know what was left behind — done when the report enumerates every skip with counts.
- S6: As a user whose notes have audio/images, I want media imported so that cards display/play correctly — done when `[sound:]`/`<img>` fields become audio/image field values with stored assets.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| `due` unit confusion (position vs unix-s vs days-since-crt) corrupts schedules | internal | High — silently wrong intervals | Mitigated: explicit per-queue conversion table + due-count parity gate (audit §2, §6) |
| AnkiConnect doesn't expose `memory_state` → FSRS precision lost on live path | external | Medium | SM-2 fallback + report disclosure + apkg escape hatch; no fixable alternative |
| anki21b is zstd-compressed; verified `fflate@0.8.3` has NO zstd support | internal | Medium | Either add `fzstd`/`@bokuweb/zstd-wasm` dep (spec decision) or document "export with legacy compat" fallback |
| Every-due-component-must-render constraint breaks imported notes lacking media | internal | High (throws NO_TEMPLATE) | Synthesized fallback templates per notetype (audit §3/§5) |
| Users import enormous decks (>10k cards) → long chunked runs, storage quota | operational | Medium | Chunking + progress + cancel; quota check pre-import |
| Re-import duplication corrupts decks | operational | Medium | Dedup by stored ankiCardId (N10) |
| Preview shows sample notes that aren't representative | human | Low | "different sample" re-roll; per-field presence hints |

## Decision

go — need is real (switching-cost removal), solution bounded and buildable on existing deps, risks all mitigated or disclosed; no legal/stakeholder blockers.

## Draft Acceptance Criteria

- [ ] Given an `.apkg` with FSRS cards, imported Tihoka cards carry identical state class, reps, lapses, and due date (day granularity).
- [ ] Given Anki running with AnkiConnect, the import completes without the user touching export; failure cases surface a guided checklist with retry.
- [ ] Subdecks import as flat decks named `A › B › C`; no `parentId` links created.
- [ ] Suspended and cloze cards/notes are excluded and counted in the report.
- [ ] Field mapping is editable per notetype with a live preview using the real stimulus resolution pipeline.
- [ ] Re-importing the same source reports already-imported cards and does not duplicate notes/cards.
- [ ] Revlog rows become review records; streaks/stats reflect imported history.
- [ ] Day-1 due count in Tihoka equals the source's due count (excluding skipped categories).
