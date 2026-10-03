# Plan — session-recap

> Spec: `docs/specs/session-recap.md` · Design: `docs/intent/session-recap-design-brief.md` + `*-component-mapping.md` · Worktree: `../cell-worktrees/session-recap` · Mode: all

## Architecture decisions (from spec + review)

- **Capture at dispatch seam** (`MessageBus.handleMessage`): raw payload (post tabId-injection, pre-zod-strip) + `sender` + resolved response all in scope. New `addTap()` API on bus; `sessionEventsTap` registered at bg bootstrap.
- **Lookup events**: only `payload.origin === 'immersion'` — marker set at `popupLifecycle` send site (token/web-text lookups). Prefetch (`lookupCache`), card-gen (`dictionaryGenerate`), DictionaryTab (`useDictionaryLookup`), sidepanel (`useDictionaryPanel`) không mang origin → tự loại.
- **Status events**: `WORD_STATUS_SET` (status từ payload) + `WORD_STATUS_CYCLE` (status từ response.data) khi `success:true`. Trash/restore/delete không emit.
- **Storage**: `sessionEvents` store trong `orca-local-player` (DB_VERSION 3→4, additive, idempotent createStores). `onversionchange → close + clear` để v3 pages nhường v4. Prune >90d một lần per SW session.
- **Compose**: `GET_SESSION_RECAP` — group `watch-*`/`stream-*` records → sessions (same videoId, gap ≤15m), join events (tabId match → window unique-overlap), derive statuses cho phiên cũ (source:'user', ≤30d, label `derived`), coverage từ `VideoRecord.comprehension`.
- **Surface**: `RecapTab` trong universal panel — Session ledger (hero card + list). Term chip → `openDictionaryLookup(term)` (reuse VocabularyTab `onLookup` prop pattern).

## Tasks

| # | Task | Files | AC | Parallel |
|---|------|-------|-----|----------|
| T1 | Data layer: SessionEvent type + store + repo fns + versionchange | `mediaLibraryRepository.ts` | AC-1,7 | — |
| T2 | Message surface: `GET_SESSION_RECAP` type/schema/registry + `origin` field + immersion marker | `messages.ts`, `types.ts`, `schema.ts`/`dictionarySchemas.ts`, `registry.ts`, `popupLifecycle.ts` | AC-1 | — |
| T3 | Event tap: `bus.addTap` + `sessionEventsTap` + bg registration | `messageBus.ts`, `sessionEvents.ts` (new), bg bootstrap | AC-1,2,7 | T2 |
| T4 | Pure grouper + unit tests | `src/features/sessionRecap/logic/sessionGrouper.ts` + test | AC-1,2,4,6,9 | — |
| T5 | `GET_SESSION_RECAP` handler (compose: history+events+videos+statuses) | `handlers/sessionRecap.ts`, bg bootstrap | AC-1,3,4,6,9 | T4 |
| T6 | RecapTab UI + panel wiring + i18n en+vi | `features/sessionRecap/ui/`, universalPanel ×5 touch-points, `messages/{en,vi}.json` | AC-3,5,8 | T5 |
| T7 | Gates + browser verify + fresh-context verify + docs/ADR/changelog | — | all | — |

## Constants

`SESSION_GROUP_GAP_MS = 15*60_000` · `SESSION_EVENTS_MAX_AGE_DAYS = 90` · `DERIVE_LOOKBACK_DAYS = 30` · `LIVE_FLUSH_MS = 90_000` · `TERMS_CAP = 30`

## Risks

- `onversionchange` close on the page-side connection → page's next IDB op re-opens lazily (getDB reopens when dbInstance null — v4 already open by then). Bounded retry ×1 in append path for the blocked window.
- derive over-attribution (remote-synced `source:'user'` marks) → `derived` label, accepted.
- `getAllWordStatuses` has read-time side-effect (deletes `unknown` rows) — same behavior as VocabularyTab, accepted.
