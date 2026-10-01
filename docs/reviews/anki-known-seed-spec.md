# Spec Review — anki-known-seed

Verified against codebase: `popupTypes.ts:18-19` (4-status union + `STATUS_CYCLE`), `dictLocalSource.ts:38-43` (`WORD_STATUSES` set), `connectAdapter.ts:11` (`AnkiConnectInvoker`), `srs/types.ts:141-182` (`SrsCard.components` + `scheduledDays`), `statusKeyControls.ts:6-11` (keys 1–4), `tokens.json` (`color-token-status-*`, `chip-status.*`), `settingsStore.ts:20` (`CURRENT_SCHEMA_VERSION = 33` → v34 accurate), `sync.ts:307-313` (alarms precedent), `manifest.json:24-26` (`<all_urls>` + CSP `connect-src http:` already cover `127.0.0.1:8766` — the Boundaries flag resolves benign).

Blockers:
1. [REQ-5 / Write-back flow] [TL]: `setSpecificValueOfCard(ivl=max(21,current), queue=2, type=2)` omits `due`. For cards leaving learn/new/day-learn queues, `due` encodes an epoch timestamp or position — setting queue=2 without rewriting `due` to a relative-day value produces an unschedulable/corrupt card. This is exactly the high-impact "corrupt Anki scheduling" risk the intent flags. Fix: specify the full key set (`ivl`, `queue`, `type`, `due` — and pin down `odue`/`odid` handling for filtered-deck cards) and cite the exact `setSpecificValueOfCard` param shape (`{card, keys, values}`) so the build writes a correct call, not just a named one.
2. [REQ-7 rule 4 + Actor table + Data table] [TL/BA]: Provenance on the wire is contradictory. Spec claims `source?` travels in the Drive `wordStatus` domain and `WordStatusEntry` extended fields live in both IDB and Drive — but the real sync layer serializes only `{term,status,updatedAt}` (`readLocalValue` :428, `collectSnapshotEntries` :448, `writeRemote` :490). Meanwhile REQ-7 rule 4 says sync writes are *skipped* by Drive-broadcast dedup — which also means a second device without Anki installed never inherits Anki-derived statuses, a product consequence the spec never states. Remote writes also arrive via `writeRemote`, bypassing the REQ-7 arbitrator entirely. Fix: decide explicitly — provenance local-only (fix Actor/Data tables, state the cross-device consequence) or synced (describe the value-shape extension + how remote merge participates in arbitration).

Major:
1. [REQ-1 Exception] [TL]: "older extension version syncing `learning` → sync layer keeps the raw string" is false — `putMaterializable` (:463-467) rejects any record whose status isn't in `WORD_STATUSES`, so an old client drops `learning` records on apply (no retention, no corruption, likely re-rejected each pull). Fix: either make raw-string passthrough an explicit requirement, or state the actual degradation. Also enumerate the `WordStatus` zod enum in `dictionarySchemas.ts` among surfaces to extend.
2. [REQ-3/6 flows] [TL]: `findCards(mod>lastSync)` is not valid Anki search syntax — `findCards` supports `edited:<days>` (day granularity), not arbitrary timestamps. Fix: incremental path = `findCards('edited:N')` or client-side filter on `cardsInfo`'s `mod` field.
3. [REQ-6 Rules / REQ-8] [TL]: "poll interval ≥15s" is below the `chrome.alarms` floor (30s, Chrome 120+, MV3 SW wake). Fix: reconcile to ≥30s alarm tick + tab-focus/on-demand triggers, or state the real cadence.
4. [REQ-5/REQ-8] [PO]: Toggle interplay unspecified — is `writeBackEnabled` gated on `enabled`? If sync is disabled, do queued write-back tasks (24h TTL) flush on manual "Sync now" or die? Fix: one sentence + a state row.

Minor:
1. [REQ-5 vs REQ-8/Data] [BA]: Settings key inconsistency — `ankiSync.writeBackEnabled` vs `ankiStatusSync`.
2. [REQ-2] [TL]: Input declares a `suspended` field; `NormalizedAnkiCard` has none — queue=-1 encodes it. Drop the phantom field.
3. [Traceability] [BA]: SC-10 (AnkiConnect unreachable) has no Need row; map to N5/TO-BE-4.
4. [Spec-wide] [TL]: No rejected-alternatives record; addon release channel (zip vs AnkiWeb) still undecided though intent deferred it to SPECIFY — resolve or name the owner.
5. [REQ-7] [TL]: Every existing `setWordStatus` caller must stamp provenance — enumerate the caller surface (popup keys, vocabulary, subtitle, Quick Add) so scope is visible.
6. [REQ-1] [PO]: Cycle position `tracking→learning→known` means the popup footer click now stops on `learning` en route to `known` — confirm intended UX.
7. [REQ-6] [TL]: Port 8766 hardcoded; consider making it configurable like `ankiConnectUrl`.

Nhận xét theo role:
- BA: Traceability is strong both directions (all N1–N8 and all 9 REQs map; only SC-10 orphaned), but the Drive-dedup decision hides a real cross-device product consequence.
- PO: Flows consistently carry alt + exception paths and SCs are testable; the enabled/write-back toggle interaction is the one untestable gap.
- TL: Good reuse anchors everywhere (`AnkiConnectInvoker`, `STATUS_CYCLE`, alarms, settings-slice pattern); two verified inaccuracies vs the codebase (sync wire shape, `putMaterializable` rejection) plus one real Anki scheduling-semantics defect (`due`).

Action items:
1. Fix write-back field set: add `due` (and decide `odue`/`odid`), cite exact `setSpecificValueOfCard` params — REQ-5 — required.
2. Resolve provenance-on-Drive contradiction; update Actor/Data tables or describe wire-shape extension + remote-merge arbitration; state second-device consequence — REQ-7 — required.
3. Correct REQ-1 exception to actual old-client behavior (reject-not-retain) + list `dictionarySchemas` enum — required.
4. Replace `findCards(mod>…)` with `edited:N`/`cardsInfo.mod` client filter — REQ-3/6 — required.
5. Fix addon-feed poll floor to alarms-legal cadence — REQ-6/8 — required.
6. Specify `enabled` × `writeBackEnabled` interaction — REQ-5/8 — required.
7. Unify settings key name; drop phantom `suspended` input field; map SC-10; name addon release channel or owner — minors.

Risks chấp nhận:
- `setSpecificValueOfCard` version drift — accepted risk already logged; revisit if capability-detect lands as `unsupported` on mainstream AnkiConnect.
- Manual addon install friction — accepted; poll path is fully functional.
- `ankiTermLinks` store placement deferred to build — revisit if a second sync-adjacent DB would fragment backups.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

- REQ-5: write-back now specifies `due` (relative day offset ≥ today+1) alongside `ivl/queue/type`, cites exact `{card, keys, values}` param shape, and covers filtered-deck cards (`odue=due`, `odid` untouched). Toggle interplay specified: `writeBackEnabled` gated on `enabled`; queued tasks flush on next successful tick or manual "Sync now", dormant while disabled, 24h TTL.
- REQ-7: provenance decision made — wire shape extended to `{term,status,updatedAt,source?,sourceAt?}`; second-device consequence stated (statuses replicate, write-back never retriggers on remote writes — echo impossible); all `setWordStatus` caller surfaces enumerated as `source='user'`.
- REQ-1 exception corrected: old clients reject `learning` records via `WORD_STATUSES` guard (dropped on apply, no corruption); surface list now includes `dictionarySchemas.ts` zod enum + provenance caller sweep.
- REQ-3/REQ-6: `findCards(mod>…)` replaced with `edited:<days>` + client-side `mod` filter on `cardsInfo`.
- REQ-6/REQ-8: poll cadence reconciled to `chrome.alarms` floor (5-min tick matching SYNC_TICK pattern + tab-focus/on-demand); addon port configurable via `settings.ankiStatusSync.addonPort` (default 8766).
- Minors: settings key unified to `ankiStatusSync.*`; phantom `suspended` input dropped (queue=-1 encodes it); SC-10 mapped to N5; addon release channel decided (zip in release assets; AnkiWeb deferred to release owner); cycle UX (`learning` stop en route to `known`) recorded as accepted all-mode decision; rejected-alternatives list added to Open Questions.
