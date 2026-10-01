# Verify — anki-known-seed

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/anki-known-seed.md` (APPROVE_WITH_CHANGES, fixes applied) · Intent: `docs/intent/anki-known-seed.md` · Design: `docs/intent/anki-known-seed-design-brief.md` + component mapping (vision-reader PASS)

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean |
| `npm run lint` | pass | eslint clean (fixed: JSX entities in mockup, useless assignment in service) |
| `npm run test:unit` | pass | 657 suites / 7749 tests — incl. statusRules/feedParser/writeBack/statusSyncStorage suites; stale pins updated (STATUS_CYCLE 5-status, schema v34) |
| `npm run build` | pass | vite build + postbuild CSP patch |
| `check-feature-cycles` / `check-deep-imports` | pass | 27 features, 62 edges clean; 0 new deep imports |

## Real-browser verification (Playwright + packed `dist`, Chromium)

`e2e/extension-anki-status-sync.spec.ts` — 3/3 pass:

1. **Manual sync end-to-end** — `ANKI_STATUS_SYNC_RUN` against the live AnkiConnect on this machine (`localhost:8765`): `lastTrigger=manual`, `cardsSeen=20`, `changed=5`; `WORD_STATUS_LIST en` shows entries written with `source='anki'` and `status ∈ {learning, known}` — provenance-bearing writes observed in the real dictionary store.
2. **SRS → wordStatus via message boundary** — `SRS_ADD_NOTE` → full review walkthrough (sound → meaning → spelling, Remember) on the real `srs-study` page → `ANKI_STATUS_SRS_REVIEWED` → `WORD_STATUS_LIST` reports `immerse` = `learning` (fresh card, scheduledDays < 21).
3. **Settings UI** — universal panel → Settings tab → Sync card renders the `anki-status-sync` section: "Sync word status" toggle enabled by default, "Write back to Anki" gated off, "Bridge add-on port" = 8766. Screenshot: `e2e-results/default/anki-status-sync-settings.png`.

Offline path is fail-soft by construction and unit-tested: AnkiConnect unreachable → `consecutiveFailures`/`errors` incremented, `{ok:true, offline:true}` for alarm runs, exception surfaced only on manual trigger — primary flows never break.

## Architecture decisions taken during hardening

- **Cycle break**: `srs → ankiStatusSync → srs` broken by moving the review hook to a background message (`ANKI_STATUS_SRS_REVIEWED`); `SrsStudyProvider` only depends on `sendMessage`. Lesson recorded (`feature-cycle-break-via-bg-message`).
- **Deep imports**: `normalizeTerm`/`setWordStatusFromSync` exported through `features/dictionary` barrel; `getSrsDB`/`SRS_STORES`/`getCard`/`getDeck`/`getCollection` through `features/srs` barrel.
- **Transport**: `createDirectInvoker` (direct `fetch` → `invokeAnkiConnect`) because background cannot `sendMessage` to itself.
- **Scheduling lifecycle**: alarm wiring moved into `init()` beside `wireSyncScheduling` — `registerHandlers()` runs before `unsubscribers` is bound.

## Requirement traceability

- `learning` status: persisted entity + blue token color, vocab filters/chips/counts, popup footer, keymap `5`, comprehension weighting, i18n en+vi, Drive wire shape round-trip (`dictLocalSource` carries `source`/`sourceAt`).
- Provenance + LWW: `wordStatusArbitration` (user > anki > srs > import, `sourceAt` vs `sourceAt ?? updatedAt`, non-user can't downgrade `known`, legacy rows treated as user, `unknown` never persisted).
- Anki → status: addon feed (`feedParser` envelope/JSONL, malformed rows skipped without cursor advance) → fallback AnkiConnect poll; suspended skipped; `ivl>=21→known`; mod-seconds→ms −1ms.
- SRS → status: post-review message hook + post-import `seedStatusesFromSrs`.
- Write-back: opt-in (default off), user-originated `known` only, `setSpecificValueOfCard` on existing non-suspended cards, retry queue, echo suppression.
- Settings: schema v34 `ankiStatusSync {enabled, writeBackEnabled, addonPort}`; panel in Sync card; en+vi copy.
- `extras/anki-bridge/`: localhost-only add-on, port 8766, JSONL cursor buffer ≥7d/10k rows, install README.
