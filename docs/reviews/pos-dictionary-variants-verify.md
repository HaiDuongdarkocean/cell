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

## Post-ship Brave e2e (second pass)

Real Brave (MV3, production `dist`) + seeded `orca-dict-*-en` IndexedDB on mock
StreamFlix (`tmp/pos-dictionary-variants/e2e-brave.mjs`, evidence
`tmp/pos-dictionary-variants/e2e/*.png` — deviceScaleFactor 2): **28/28
assertions pass** over deep shadow-DOM reads + real mouse clicks.

- `still` nav `[adjective, adverb, noun, other]`; per-variant swap verified for
  IPA (`ame /stɪl/` → `bre`), status (`Unknown`/`Learning` per pos row), COCA
  chips (720 / 115 from raw `r` / 5,200 from raw `n` / 999 term-fallback),
  word forms (`plural stills` noun-only), senses.
- Status cycle writes `still␟adjective = tracking` row confirmed in IDB.
- `matter` nav `[noun, verb]`, statuses `Known`/`Tracking` per pos row, verb
  inflections scoped; single accent → non-interactive label.
- `silence` (single pos) → nav hidden, IPA renders.

### Defects found by the e2e (fixed post-ship)

| Finding | Disposition |
|---|---|
| `normalizePos('adj.')` returned `'adj.'` — trailing-dot dictionary abbreviations split senses into a pos-less twin variant, divorcing defs from prons/freq/status | **Fixed** — key now strips trailing dots before alias lookup (`adj.`/`n.`/`v.`/`adv.`/`v.t.` → canonical); matches the abbreviation claim already in ADR-113/arch table |
| POS-scoped fields leaked across variants — `displayInflections`/`displayStars`/`displayFrequencies`/`displayReading` fell back to term-level values when the selected variant lacked them (noun `plural stills` painted under adjective/adverb) | **Fixed** — strict `V.field` per spec swap contract (spec §Popup swap); term-level freq fallback still folded into `V.frequencies` at orchestration |

### User-reported defects after manual import (fixed round 2)

| Finding | Disposition |
|---|---|
| `macmillan2ed` emitted `pos: 'variant'` (638 rows) — the `#6020ae` purple font is reused for spelling-variant stubs ("Main entry: …"), producing a bogus `variant` nav option | **Fixed** — adapter rejects `variant` as pos (falls to `''`/other bucket); `macmillan-2ed.json` regenerated, `a` now `[noun, determiner, abbreviation, other]` |
| `JsonEntriesStrategy` dropped `prons` at import — converted files carried per-accent prons but the strategy never forwarded them → variants had no IPA/accent at all | **Fixed** — `JsonEntry.prons` forwarded + regression test asserting stored `prons` |
| Accent label rendered lowercase `ame`/`bre` (CSS `text-transform` + `.toLowerCase()`) | **Fixed** — renders `AmE`/`BrE` verbatim |
| PosVariantNav colors inverted — inactive links were primary+underlined, active was plain | **Fixed** — inactive = `--color-text` no underline, `:hover` = underline, active = `--color-primary` + semibold |

### User-reported defects after manual import (fixed round 3)

| Finding | Disposition |
|---|---|
| Accent pick did not persist — `accentByPos` reset per candidate, so `BrE` chosen on one lookup reverted to `AmE` on the next | **Fixed** — last accent written to `chrome.storage.local` (`dictAccentPreference`); new candidates default to it when the variant carries that accent. Brave e2e: `still` re-lookup after `matter`/`silence` shows `BrE` (assert + `09-still-persisted-bre.png`) |
| `●●●` frequency stars rendered on the IPA row, duplicating the COCA rank chip | **Fixed** — stars moved to their own line directly under the frequency chip row (`01-still-adjective.png`); e2e asserts stars absent from IPA row and geometrically below the chips |

e2e harness hardened: `brave-ext`/`brave-profile` are wiped each run and `dist/manifest.json` is required up-front — the prior run silently replayed a stale extension copy when `dist/` was emptied between build and copy.

### User-reported defects after manual import (fixed round 4)

| Finding | Disposition |
|---|---|
| Inflection type labels (`singular`, `plural`, `past tense`, `present participle`, …) rendered in the same bright color as the forms — chrome text competed with the actual inflection values | **Fixed** — type labels use `cellMetaLabel` (muted, same tone as `word forms:`); forms stay primary-bright (`07-matter-verb.png`) |

### User-reported defects after manual import (fixed round 5)

| Finding | Disposition |
|---|---|
| Dictionary `●●●` stars row — user wants dictionary-supplied frequency shown as a chip like COCA (`source ★★★`), not a bare dots line; and Macmillan frequency NOT extracted into converted JSONs | **Fixed** — `PosVariant`/`LookupResult.frequencyStars` now `{count, source}` (orchestrator tags the supplying resource); CandidateView renders it as a freq chip `{source} ★★★` inside the chip row (`01-still-adjective.png`, e2e asserts `EnEn (e2e)★★★` inside `freq-row`, absent from IPA row). `macmillan.mjs`/`macmillan2ed.mjs` no longer emit `frequencyStars`; both JSONs regenerated (0 `frequencyStars` occurrences). `defEntry` card path passes `.count` (behavior unchanged) |

## Residuals

- `.mdd` audio extraction deferred by spec — `sound://` refs stored verbatim.
- REQ-9 hot-path approximation (documented in spec Alt flow): overlay aggregate
  counts only materialized pos rows; an unmarked variant is absent rather than
  `unknown` — a single tracked variant can surface as the term color until
  another variant is marked.
- Full COCA/Macmillan bulk import into a live profile not run end-to-end;
  converters verified on real MDX fixtures per-term (`present`, `water`,
  `tomato`) + full COCA conversion run completed during build.
