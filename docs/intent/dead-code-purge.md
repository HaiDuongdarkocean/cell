# Intent: dead-code-purge

> Slug: `dead-code-purge` · Mode: all · Source: backlog row #17 (internal-audit, `docs/audits/20260916_src-features-entrypoints-shared.md`)
> ui_surface: no
> confidence: high

## Analysis

**Every named dead-code claim is already resolved** — the audit (2026-09-16) predates the M19 Strangler Fig completion + `dddcc726` debt commit:

| Backlog claim | Current code |
|---|---|
| `USE_LEGACY_*` hardcoded false + 2 legacy impls | zero `USE_LEGACY` hits in `src/` — removed by `dddcc726` "drop legacy fallbacks" |
| dead export `fetchAllSegments` | zero hits — no such export exists |
| `@/types` 35 import sites | zero `from '@/types'` hits — all 94 migrated to `@/entities/*` by `e5132dfa` (ADR-017 D6); `src/types/` now holds only ambient `.d.ts` declarations |
| `AudioPanel×2` duplicates | `features/audio/ui/AudioPanel.tsx` (audio settings, used by `SettingsDialogContent`) and `dictionaryPopup/ui/PronunciationAudioPanel.tsx` (pronunciation, used by `CandidateView`) are distinct live components — not duplicates |
| ~18 dead tests | swept with the legacy impls — no orphan test files remain |

Residual check: the only `legacy` mention in download/audio is `downloadSaver.ts:165` — an intentional runtime OPFS→data-URL fallback path, live code.

## Residual follow-ups (recorded, not implemented)

- None.

## Decision

**no-go** — every artifact the row names (USE_LEGACY flags, fetchAllSegments, @/types shims, AudioPanel duplicates, dead tests) was already purged by `dddcc726`/`e5132dfa`; nothing left to delete.

## Acceptance criteria

- n/a — dropped at analyze (purge already done).
