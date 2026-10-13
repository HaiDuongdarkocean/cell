# Intent: per-word translation gloss on tokenized subtitles

> Slug: `word-translation` · Mode: interactive · Source: user statement — "thêm tính năng dịch từng từ đã tokenize"
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Watching with tokenized subtitles, the user hits words they can pronounce (IPA shipped) but cannot *understand* — every unknown word costs a pause + popup open/close cycle | User's original motivation for reading-annotation: "không đọc được sub khi chưa thuộc cách phát âm" — same pain one level up (meaning, not sound); `webTextDictionaryController.ts` popup flow = the current costly path | 85% |
| Change | Subtitle tokens show only glyphs + IPA → tokens also carry a native-language gloss under the word | Reading caps: `tokenSpanCss.ts` `::before content: attr(data-reading)`; `videoTokenPreloader` chunked resolve | 90% |
| Solution | Fetch one-line translations per unique token term via the existing background TRANSLATE path, cache per (term, source→target lang), render as a `data-gloss` cap under the word — same mechanism as `data-reading` | `src/entrypoints/background/handlers/translate.ts` (Google→MyMemory); `videoTokenMap.ts:123` `resolveTerms` | 80% |
| Value | Uninterrupted comprehension while watching — dictionary popup stays the deep-dive, gloss is the glance layer | User confirmed placement + coexistence with IPA in analyze interview | 85% |
| Stakeholder | Language learner watching video with dual subtitles (persona: 5–80, weak machines incl.) | AGENTS.md persona line | 90% |
| Context | MV3 content script; translation goes through background (CORS bypass); unofficial MT endpoints are rate-limited; subtitle cues number in the thousands per episode | `translate.ts` timeouts 4s/6s; preloader chunking exists for this reason | 85% |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers | Reuse resolveTerms/chunked pipeline; gloss must not regress weak-device perf | Tokenize + readings infra already built |
| Customer | Learner watching subs | Glance-level meaning without breaking playback flow | none — end user |
| Supplier/Dependency | Google Translate unofficial endpoint + MyMemory fallback | ~1 request per unique term per episode; needs caching + throttling to survive rate limits | No SLA; MyMemory daily quota is small — treat as fallback only |
| Organization | Future contributors | `data-gloss` pattern mirrors `data-reading`; keep parallel CSS/logic structure | none |
| Regulator | Chrome Web Store policy | No new permissions; TRANSLATE already shipped | none |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Show a native-language gloss per tokenized subtitle word, inline | F | User statement + interview | 90% |
| N2 | Gloss sits **under** the word; IPA cap stays above — both visible at once | U | User picked "Dưới chữ" + "Cả hai cùng lúc" | 95% |
| N3 | Gloss language = `settings.subtitleOverlayNativeLanguage` | U | User picked native-language option; setting exists (`entities/settings/types.ts`) | 90% |
| N4 | Fetch lazily + chunked + deduped per unique term, cached across cues/session; survives MT failure without breaking subs | P/R | Preloader pattern `videoTokenPreloader.ts:92-152`; translate timeouts exist | 80% |
| N5 | User can toggle glosses on/off live, same mechanics as `showReadings` (settings + storage-change propagation) | F/U | `contentScriptController.ts:611-613` pattern | 85% |
| N6 | Glosses do not break wrapped-line layout — bottom headroom reserved like top margin does for IPA | U | Wrap-overlap bug just fixed via `margin-top:0.85em` | 80% |
| N7 | Glosses are visual annotations — not copied into text selection, same as readings | U | `::before`/`::after` pseudo-element approach is non-selectable by construction | 90% |

## Scope

- **In:** per-term translation gloss under word tokens on the **subtitle overlay block**; toggle in Settings → Subtitle Block next to "Show readings"; chunked fetch + term cache + `termToCues`-indexed re-resolve; bottom headroom CSS; native-language target.
- **Out:** cue list, card preview, universal panel (user: "chọn 1" — overlay block only); sentence-level alignment tricks; new translation providers; per-language format selection UI.
- **Non-goals:** replacing dictionary popup; inline grammar/furigana ruby layout; translating native (vi) lines.

## Workflow

Person↔device: learner plays a video with tokenize enabled and gloss toggle on → Tihoka tokenizes each cue → for each unique term not yet translated, Tihoka asks background TRANSLATE (chunked, like readings) → background calls Google unofficial (MyMemory on failure) → gloss lands in a term→gloss cache → tokens re-resolve → gloss paints under the word via a pseudo-element → learner reads meaning inline; click token → popup for full dictionary detail (unchanged). System↔system: content script ↔ background SW ↔ translate endpoints; on resource/lang change the cache invalidates like readings do.

## Journey

### AS-IS
1. Learner plays a video; tokenized subtitle overlay renders with IPA caps.
2. A word whose meaning is unknown appears (e.g. "forgotten").
3. Learner pauses or races the dialogue, ctrl/clicks the token to open the dictionary popup.
4. Reads definitions, closes popup, resumes — flow broken once per unknown word.
5. On long unfamiliar stretches this repeats many times per scene.

### TO-BE
1. Learner plays a video with tokenize + word-translation enabled.
2. Each word token shows its gloss in the native language under the glyph; IPA stays above.
3. Learner reads the line as `word(gloss)` pairs without pausing; unknown-word meaning arrives inline.
4. For nuance beyond a one-word gloss, learner still clicks the token → full popup.
5. Toggling the feature off restores plain token rendering instantly; wrapped lines never collide with glosses.

## Stories

- S1: As a learner, I want a native-language gloss under each subtitle word so that I can follow dialogue without opening the dictionary — done when a live cue shows glosses under word tokens on the overlay.
- S2: As a learner, I want glosses to coexist with IPA so that sound and meaning are both glanceable — done when a token renders cap above + gloss below simultaneously.
- S3: As a learner on a weak machine, I want glosses to resolve without jank — done when chunked/deduped fetches reuse the term→cue index and no full-cue re-scan happens per chunk.
- S4: As a learner, I want to hide glosses instantly — done when toggling the setting removes glosses from all rendered tokens live.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Single-word MT loses context → misleading glosses | external | Medium — accepted: gloss is a hint layer, popup is truth | Label as gloss, not translation; popup remains one click away |
| Google unofficial rate-limit on high term volume | external/operational | Medium — chunking + per-term cache + MyMemory fallback caps exposure | Same dedupe discipline as readings (few hundred unique terms/episode after first) |
| Bottom headroom distorts line spacing / collides with next line | internal | Low-Medium — same class of bug as IPA wrap overlap, same fix pattern | `margin-bottom` reserve + real-browser verify incl. wrapped 2-line cue |
| MT endpoint failure mid-episode | operational | Low — null gloss, token renders without it; retried on next chunk | `.catch(() => null)` pattern already in preloader |

## Decision

go — cheap to build on readings infra (resolveTerms, chunked flush, pseudo-element caps, storage-change wiring all exist); need is the direct successor of the pronunciation pain the user just shipped a fix for.

## Draft Acceptance Criteria

- [ ] With the gloss toggle on, overlay word tokens render `data-gloss` text under the glyph in `subtitleOverlayNativeLanguage`.
- [ ] IPA cap above + gloss below render simultaneously without overlap on wrapped lines.
- [ ] Toggle off → glosses disappear live; toggle on → re-resolve without reload.
- [ ] Unique terms are fetched once per page session; chunk failures degrade to no-gloss, never broken subs.
- [ ] Glosses never enter copied text / selection.
