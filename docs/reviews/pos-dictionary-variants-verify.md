# Verify: pos-dictionary-variants

> Post-build review of committed tree `e38927ef` (56 files) against
> `docs/specs/pos-dictionary-variants.md` — one major status-semantics
> defect found and fixed pre-commit; residuals noted.

VERDICT: PASS

## Deterministic gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` (item files) | PASS — fixed 4 `no-useless-escape` (macmillan.mjs), unused `readFileSync` (tihoka-convert-frequency.mjs), missing useCallback deps (useCandidate.ts) |
| `npm run test:unit` | PASS — 668 suites / 7,893 tests |
| `npm run build` | PASS |
| Real-browser verify | PASS — Playwright Chromium on showcase Real tab (`tmp/pos-dictionary-variants/verify-real.mjs` + `real-*.png`) |

Browser evidence (`PopupDictionary` thật, mockup entrypoint): `present`
nav `["adjective","verb","noun"]`; adj → `/ˈprezənt/` + Unknown + COCA 1,334;
verb swap → `/prɪˈzent/` + Learning + COCA 818 + verb word-forms; accent
label `ame → bre` on click; `well` nav ends with `other`; `serendipity`
(single pos) hides nav, accent label still present; zero page errors.

## Findings fixed during verify

| Finding | Disposition |
|---|---|
| `WORD_STATUS_CHANGED` (popup emit + cross-tab broadcast) carried the **variant** status in the `status` field → overlay/tokenize would paint `present` as `learning` while aggregate stays `unknown` | **Fixed** — `status` field now carries `aggregatePosStatus(term, materialized pos rows)` (`useCandidate.cycleStatus`, `handlers/wordStatus.ts` `aggregateTermStatus`); `pos` kept on the payload for pos-aware listeners |
| `getWordStatuses` (subtitle/web overlay hot path) ignored pos rows → term with all variants marked never reflects | **Fixed** — added `getPosStatuses(lang, terms[])` batch prefix-scan; `getWordStatuses` folds rows via `aggregatePosStatus` (spec REQ-9 approximation: unmaterialized variants treated as absent) + 2 regression tests |
| Test expectation drift | **Fixed** — variant-assembly tests updated for least-learned aggregate + per-resource term-level freq fallback ordering; `dictionaryGenerate.test.ts` aligned to `88995bfd` IPA-wrap behavior (pre-existing failure) |

## Per-REQ review

| REQ | Verdict | Evidence |
|---|---|---|
| REQ-1 COCA → per-pos freq json | met | `tihoka-convert-frequency.mjs`; `present` → 4 rows (j:1334, n:2259, v:818, r:8560) + total + 5 genres |
| REQ-2 MacmillanEnEn per-homograph | met | `macmillan.mjs` `blocks()`-based homograph split → 1 row/pos with scoped senses/stars/inflections/AmE prons + `sound://` audioRef |
| REQ-3 Macmillan 2nd Ed dual accent | met | `macmillan2ed.mjs`; `water`/`tomato` → UK+US prons per homograph, unnumbered-sense gloss fix |
| REQ-4 json-frequency import | met | `jsonFrequencyStrategy` + formatDetector wiring; FrequencyEntry `{pos,total,genres}` |
| REQ-5 variant merge at lookup | met | orchestrator groups senses/prons/freq by normalized pos; term-level freq fallback per resource; `variants` only when ≥1 real pos (`''`-only → undefined) |
| REQ-6 POS selector + swap | met | `PosVariantNav` buttons + `|` separators above headword, ≥2 variants gate, first selected; swap updates IPA/status/freq/inflections/defs/image/prefill |
| REQ-7 accent toggle | met | muted lowercase `ame`/`bre` label before IPA; click cycles `variant.prons`; ≤1 pron → static label; per-pos selection persists across switches |
| REQ-8 per-pos status | met | `term␟pos` rows; read `pos → term → unknown`; quota + sync-capture parity with term writes |
| REQ-9 aggregate for term consumers | met (after fix) | `aggregatePosStatus` least-learned; folded in `getWordStatuses` + broadcast + `result.status` |
| REQ-10 prefill = selected variant | met | `buildCandidatePrefill` takes variant + accentIndex; `PopupSelectionSnapshot.pos` set |
| REQ-11 no-pos regression | met | single/other-only terms → `variants` undefined → legacy flat render; serendipity verified |

## Residuals

- `.mdd` audio extraction deferred by spec — `sound://` refs stored verbatim.
- REQ-9 hot-path approximation (documented in spec Alt flow): overlay aggregate
  counts only materialized pos rows; an unmarked variant is absent rather than
  `unknown` — a single tracked variant can surface as the term color until
  another variant is marked.
- Full COCA/Macmillan bulk import into a live profile not run end-to-end;
  converters verified on real MDX fixtures per-term (`present`, `water`,
  `tomato`) + full COCA conversion run completed during build.
