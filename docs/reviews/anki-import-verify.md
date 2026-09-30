# Verify — anki-import

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/anki-import.md` · Intent: `docs/intent/anki-import.md` · Plan: `tasks/plan-anki-import.md`

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean (incl. 1-char fix to `youtube-main-world.iife.ts` `prev?.kind` — main-branch regression from another lane blocking the shared gate) |
| `npm run lint` | pass | eslint clean (incl. 2 `no-unused-expressions` fixes in `SrsReviewCardBack.tsx`, same origin) |
| `npm run test:unit` | pass | 7684/7687; 2 suites (`webTokenizeController`, `check-design-system-css` timing budget) are load-flaky and pass in isolation — unrelated to this feature |
| `npm run build` | pass | vite build + postbuild CSP patch clean; `check-icons` 92 pass; `check-feature-cycles` clean; `check-deep-imports` 169 pairs clean |

Anki-import suites: 7 files, 46 tests — apkgAdapter, connectAdapter, deckFlatten, fieldMapping, stateConvert, revlogMap, importWriter (incl. idempotent re-import + suspended/cloze skip + media hit/miss).

## Real-browser verification (packed extension, real Chromium, cloned profile)

`tmp/anki-import/verify.mjs` + generated fixture `tmp/anki-import/fixture.apkg` (sql.js-built collection.anki2: Basic + Cloze notetypes, nested deck `Lang::JP::Core`, filtered deck, review/new/suspended cards, 3 revlog rows) — **VERIFY: PASS**, screenshots `tmp/anki-import/verify-*.png`:

- `verify-home` — import icon button in Memory topbar before settings gear
- `verify-source` — 2-CTA source screen (AnkiConnect primary, .apkg secondary)
- `verify-scope` — deck list with flattened `Lang › JP › Core`, counts `2 new · 3 review · 1 won't import` (suspended); Cloze row disabled with `unsupported` badge
- `verify-language` — target language step
- `verify-mapping` — per-notetype field mapping (Front→Target word, Back→Sentence auto-guess) + live front/back card preview with sample nav
- `verify-report` — `4 imported · 1 suspended · 1 cloze · 0 duplicates · 0 failed · media 0✓/0✗ · 3 review events · 1 deck`
- `verify-home-after` — `Lang › JP › Core` deck on home with `4 reviews · 1 new`, collection intact

## Requirement traceability

- Entry: ghost-circle import icon before settings in `SrsHome` topbar; new `import` icon via ICON_CATALOG; accessible aria-label, i18n en+vi
- Sources: AnkiConnect direct (injected invoker over existing `CARD_CREATOR_REQUEST` relay, saved URL auto-test, troubleshooting only on failure) + `.apkg` file (anki2/anki21/anki21b-zstd)
- Scope picker: deck + notetype selection; filtered decks excluded; filtered cards routed via `odid`; cloze disabled+counted
- States: `type` 0–3 → FSRS 0–3 fan-out to meaning/sound/spelling components; suspended skipped (counted); buried flag ignored, underlying type preserved; `memory_state` decoded for apkg, ivl/factor estimate for connect (fidelity flagged)
- Due: apkg `crt`+queue-aware units; connect `lastReview + ivl` estimate
- Revlog: `ease 1→forget, 2|3|4→remember`, deterministic `import-anki-<id>` ids
- Preview/mapping: per-notetype role dropdowns with heuristic prefill, live preview re-render, mapping presets persisted per notetype name, back navigation to scope
- Writer: collection/deck/config/notetype resolve-or-create, `importSource` provenance dedup (idempotent re-import), `putNoteForImport`/`putCardForImport` allow same-word siblings across decks, media lazy-resolve + quota preflight, abortable, no half-write on read failure (parse completes before first write)
- Report: imported/skipped-suspended/skipped-cloze/duplicates/failed/media hit-miss/review events/decks created
