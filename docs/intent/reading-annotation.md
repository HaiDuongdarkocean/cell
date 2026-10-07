# Intent: Reading Annotation — pronunciation/reading hints above subtitle tokens

> Slug: `reading-annotation` · Mode: all · Source: backlog row #36 (asbplayer+yomitan)
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Learners who haven't memorized the writing system (hanzi in v1 — see ja caveat) or the phoneme inventory cannot *read* the subtitles they are watching — every unknown glyph forces a popup lookup that breaks immersion. Reading hints inline keep eyes on the line. | asbplayer/Yomitan-style furigana is the canonical fix for ja/zh; IPA serves alphabetic langs; backlog row #36 states "người mới không đọc được sub" | high |
| Change | From "tap word → read popup" → "reading already visible above/below the token". The subtitle line becomes self-pronounceable. | Token layer already renders per-token spans with metadata (`tokenSpanRenderer.ts`, `tokenSpanCss.ts`) | high |
| Solution | Batch-resolve a `reading` per displayed term — reusing the exact popup rule (`pronunciation || reading` with `reading !== term` dedupe, `lookupOrchestrator.ts:809-816`) — and render it as a ruby-style annotation on the token span, gated by a settings toggle. | `DictionaryEntry.reading`/`pronunciation`/`prons` (`entities/dictionary/types.ts:199-229`) — `reading` is populated by term-bank/sqlite imports (CJK readings), `pronunciation`/IPA only by `json-entries` imports (`baseImportStrategy.ts:202-214`); `FrequencyEntry.reading` same semantic (`types.ts:86-98`); batched metadata precedent `resolveTokenListMetadata` (`tokenListMetadata.ts:33-62`) | high |
| Value | Newbie-facing accessibility of the core loop: sub stays readable before the word is learned; learners link glyph↔sound continuously instead of per-lookup. | Yomitan furigana toggle, asbplayer reading display — market-proven for CJK | high |
| Stakeholder | Immersion learners on any device; zh learners are the sharpest v1 segment (pinyin) plus any language whose dictionaries carry IPA/reading fields. | AGENTS.md persona 5–80 | high |
| Context | MV3 local-first; token spans rendered in `subtitleTokenizeController`+`videoTokenPreloader` (overlay), `webTokenizeController` (web text), `cueListTokens` (CueList React twin `CueTokenText`); dictionary rows hold `reading`/`pronunciation` — batch hydration pattern exists and is chunked (500-term messages, ≤1000/cue list) | `tokenize/controller/*`, `tokenize/logic/tokenListMetadata.ts`, `features/dictionary` entry store | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers | Reuse token-hydration pipeline + dictionary entry fields — no new storage subsystem | `tokenListMetadata`, unified entry store (`langDictionaryEntry`) |
| Customer | Learner (esp. ja/zh, also any lang wanting IPA) | Read the subtitle aloud; no extra taps; toggle it off when fluent | Persona — annotation must not clutter or hurt readability on small screens |
| Supplier/Dependency | Imported dictionaries — `reading` populated for CJK termbanks/freq rows, `pronunciation` IPA only on `json-entries` imports; `FrequencyEntry.reading` may already arrive free via `FREQUENCY_GET`; espeak phoneme engine is an in-context WASM singleton (`pronunciationEngineSingleton.ts`) hardcoded to English voices (`pronunciationEngine.ts:60`) — not a viable per-token source | Rows where `reading === term` (importer fallback) or both fields empty yield no annotation — degrade to no-hint, never block rendering | `entryStore` read path; no `reading` index — terms→readings reads deserialize full rows (same cost shape as `findFrequencyByTerms`) |
| Organization | Future contributors | Reading display is a token-layer concern; status/frequency precedent shows the batching shape | `cueListTokens` chunking; `wordStatusCrossTab`-style invalidation when profile/dict changes |

## Needs

| ID | Need | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Resolve reading text per token term in batch — one store roundtrip per cue/chunk, same contract shape as status/frequency | F, R | `resolveTokenListMetadata` precedent; no lean terms→dict-rows batch read exists (LOOKUP_REQUEST is single-term + fires `requestRemoteCheck`, `handlers/lookup.ts:33-38`) — needs a lean `READINGS_GET`-style message or an extended metadata response; freq-row readings may ride `FREQUENCY_GET` for free (`frequencyClient.ts:27-34`) | high |
| N2 | Render the reading attached to the token span across all render twins — overlay `tokenSpanRenderer` + `restyleTokenBlock`, React `CueTokenText` (CueList), both `tokenSpanCss` builders — without breaking token layout, copy/selection, or tap-to-lookup | F, U | `tokenSpanRenderer.ts:63-115` owns span+attrs; `restyleTokenBlock` re-applies classes only (attr updates needed); copy-clean `::before{content:attr(data-reading)}` vs `<rt>` markup tradeoff — spec+design decide per surface (host-page reflow risk on web-tokenize surfaces) | high |
| N3 | Opt-in toggle with a decided scope — `LanguageProfile` field (per-language, synced via `FLAT_FIELD_KEYS`) vs global Settings slice; per-surface defaults (subtitle overlay vs web tokenize) | F, U | `tokenizeSettingsStore` is per-origin and `tokenizeStateStore` `show*` flags are session-only — neither is a per-language persisted precedent; `profileResolution.ts:73-80` is | medium |
| N4 | Reading source rule = orchestrator parity: `pronunciation || reading`, `reading !== term` dedupe, `prons[]` accent selection, eligible-resources and `disabledComponents['pronunciation']` semantics decided | F, R | `lookupOrchestrator.ts:809-816` is the existing SSOT — feature must reuse it, not diverge | high |
| N5 | Performance budget: hydration adds ≤1 batched read per token list (full-row deserialization acceptable — same cost shape as `findFrequencyByTerms`); rendering must not regress cue paint on low-RAM devices; missing fields produce no visual artifact | P | chunking precedent; `by_term` index exists, `reading` is non-indexed | high |
| N6 | i18n en+vi for the setting/toggle copy | I | i18n convention | high |
| N7 | Language coverage honesty: v1 covers languages whose tokenizer yields term-level tokens AND whose dictionaries carry `reading`/`pronunciation` — zh (FMM segmentation + term-bank readings) and IPA langs; **ja is blocked**: `tokenizeTextBlock` special-cases `'zh'` only, ja falls to letter-run regex so a whole clause is one token (`textTokenizer.ts:46`) — ja furigana needs a segmenter first (named follow-up) | R | `textTokenizer.ts` zh-only special case; `fallbackPlugin` gives ja `readingKind:'none'` | high |

## Scope

- **In:** batch reading resolution (new lean `READINGS_GET`-style message — spec decides contract), `Token.reading`, annotation render on subtitle-overlay + cue-list tokens (web-tokenize surface decided in design — reflow risk), settings toggle with decided scope/defaults, i18n, missing-field degradation.
- **Out:** **ja segmentation (dependency — `tokenizeTextBlock` produces clause-level ja tokens today; furigana lands when a ja segmenter exists)**, generating readings via espeak per-token (in-context WASM, English-only voices as wired — `pronunciationEngine.ts:60`), romaji/pitch-accent beyond stored fields, hover-only reveal modes.
- **Non-goals:** not a dictionary-popup change (popup already shows readings); not a status/rank overlay redesign; no new token concepts beyond `reading`.

## Workflow

Learner enables "show readings" for the target language (or it's defaulted on for CJK). Subtitle tokens render with their stored reading as a small annotation line. Tapping still opens the full dictionary popup — annotation is glance-only. When the dictionary row lacks a reading/IPA, the token renders exactly as today. Disabling the toggle removes annotations without re-tokenizing.

## Journey

### AS-IS

1. Learner watches a zh (or IPA-covered-lang) video; subtitle shows tokens they can't pronounce.
2. Every unknown glyph → tap → popup → read furigana → close. Dozens of interruptions per minute for beginners.
3. Some give up reading-mode immersion entirely until they've memorized more glyphs.

### TO-BE

1. Learner sees `漢字` rendered with `かんじ` (or pinyin/IPA for other langs) above the token.
2. They read the line aloud continuously; taps only happen when the *meaning* is unknown.
3. Toggle off once fluent — the subtitle reverts to plain tokens.

## Alternatives

| Option | Why not / why |
|---|---|
| Real `<ruby><rt>` markup inside the token span | Renderer-side feasible, BUT `<rt>` text enters the DOM → pollutes sentence copy/selection (bad for mining). `::before{content:attr(data-reading)}` stays copy-clean; layout-cost tradeoff decided per surface in design — web-tokenize surfaces risk reflowing the host article, so overlay may get annotations while web stays off by default. |
| Espeak IPA generation per token | In-context WASM singleton (`pronunciationEngineSingleton.ts`) with per-context init (WASM + `espeak-ng-data.tar` fetch) and voices hardwired to English (`pronunciationEngine.ts:60`) — wrong weight for a hydration loop over hundreds of tokens, wrong languages for CJK. Stored fields cover the need. |
| Hover-only annotation | Solves clutter but fails the "eyes stay on the line while reading" need — users read ahead of taps. Keep static-by-default, but spec may pick a compact display. |
| **Chosen** | Stored-field readings rendered as a token-span annotation, batched like status/frequency — reuses the proven hydration seam. |

## Risks

| Risk | Mitigation |
|---|---|
| Dictionaries lacking `reading`/`pronunciation` for the active lang → feature appears broken | Spec defines source-priority chain and empty-state no-op; empty annotations render nothing (not blank gaps); Settings copy names which sources feed readings |
| Reading adds visual height → cue layout shift / overlap on video | CSS reserves annotation space only when reading present; font-size small (`xs`-tier); measure overflow on narrow cues during design; token `line-height` untouched — annotation lives in a fixed-height slot or absolutely-positioned overlay (spec+design decide) |
| Extra batched read per cue → latency on first paint | Same-chunk hydration as status/frequency (`Promise.all` in one roundtrip set); readings are display-only and may resolve a tick later without blocking token paint |
| ja has no per-word segmentation — clause-level tokens make readings useless for ja | Excluded from v1 scope (N7); a ja segmenter is the named follow-up that unblocks it |
| `reading === term` importer fallback — "empty" marker is equality, not `''` | Resolution rule reuses orchestrator dedupe (`reading` suppressed when it equals the term); same applies to `FrequencyEntry.reading` |
| IPA coverage thin: `pronunciation`/`prons` only populated by `json-entries` imports | Source rule takes `pronunciation` first when present; nothing renders when absent — feature value concentrates on zh/CJK readings and IPA-rich dictionaries |
| Mid-session dictionary import/disable/reorder — cached resolutions go stale | Spec defines invalidation (controllers already listen to `onWordStatusesReload` — `subtitleTokenizeController.ts:114-125`) |
| `readingKind` 'none' rows / IPA-vs-reading ambiguity | Reuse `readingKind` concept; surface only non-empty values; spec decides label/typography per kind |

## Decision

go — Cost M estimated at backlog. Reuse-heavy: readings already live in imported rows (`reading` for term-bank/sqlite, `pronunciation` IPA for json-entries), hydration precedent exists (`resolveTokenListMetadata`), render slot is a token-span concern. Review corrections absorbed: v1 language coverage is zh + IPA-covered langs (ja needs a segmenter — named follow-up); source rule = orchestrator parity `pronunciation || reading` + `reading !== term` dedupe; annotation tradeoff is copy-clean `::before` vs DOM `<rt>` decided per surface. Open questions for spec: message contract shape, per-surface render primitive, toggle scope/defaults, `disabledComponents`/eligible-resource semantics, mid-session invalidation.
