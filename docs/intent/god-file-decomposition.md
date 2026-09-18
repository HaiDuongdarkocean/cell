# Intent: god-file-decomposition

> Slug: `god-file-decomposition` · Mode: all · Source: backlog row #19 (internal-audit, `docs/audits/20260916_src-features-entrypoints-shared.md` item 1 residual)
> ui_surface: no
> confidence: high

## Analysis

**Every named god-file has already been decomposed** — the audit's rolling item-1 recommendation was executed before this row was written:

| Audit claim (lines) | Current code |
|---|---|
| `webTextDictionaryController` 1816 | **277** — orchestration split into per-concern modules (`controller/` now holds focused files; remaining bulk lives in its 2029-line test file) |
| `useCardCreatorState` 1425 | **file no longer exists** — domain logic moved into `features/cardCreator/service/` + `entities/cardCreator/` |
| `content-script` 1409 | **file no longer exists** — split into `entrypoints/content/` modules; largest entrypoint file is `ocrContentScript.ts` at 942 |
| `downloader` 1221 | **449** |

Current largest production (non-test) file: `features/subtitle/ui/contentScriptController.ts` at 948 — under the audit's own 1.4k+ concern threshold and cohesive (single controller concern). No god-file remains.

## Residual follow-ups (recorded, not implemented)

- None.

## Decision

**no-go** — all four named files were decomposed or dissolved; nothing above the audit's own size threshold remains.

## Acceptance criteria

- n/a — dropped at analyze (decomposition already done).
