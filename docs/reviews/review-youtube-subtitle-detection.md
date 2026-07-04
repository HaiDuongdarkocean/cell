# Spec Review: YouTube Subtitle Detection

> **Model**: Opus 4.8
> **Date**: 2026-07-05
> **Spec**: `docs/specs/spec-youtube-subtitle-detection.md`
> **Intent**: `docs/intent/intent-youtube-subtitle-detection.md`
> **Reviewer**: spec-reviewer skill (subagent, Opus 4.8)

## Status

**APPROVED_WITH_CONDITIONS**

All referenced files exist and the core approach (MAIN world proactive parse of `window.ytInitialPlayerResponse`) is feasible. However, 3 CRITICAL architectural gaps and 4 HIGH gaps must be resolved in the spec before G2 Plan can safely proceed.

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 3/4 | 0/4 | 1/4 | F1-F4 |
| Testability (QA) | 3/3 | 0/3 | 0/3 | T1-T3 |
| Scope (Product) | 3/3 | 0/3 | 0/3 | S1-S3 |
| **Total** | 9/10 | 0/10 | 1/10 | |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | PASS | HIGH | `parseVtt` (existing, now), `ytInitialPlayerResponse` (YouTube page, now, fallback: InnerTube). InnerTube ANDROID fallback feasibility questionable — see Risk #3. |
| F2 | Architecture considerations section exists? | PASS | MEDIUM | Project Structure section lists files + data flow. But data flow for YouTube path is not drawn — see Risk #1. |
| F3 | Technical constraints reviewed? | PASS | HIGH | MV3, Chrome 111+, MAIN world, no new deps, TypeScript strict. |
| F4 | Rollback strategy for stateful changes? | NA | HIGH | Stateless — `DetectedSubtitle` extension is optional fields, no storage migration. |

### Testability (QA)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | PASS | CRITICAL | A1-A7 each specify edge-devtools MCP verify steps. |
| T2 | Edge cases ≥2 per user story? | PASS | HIGH | F1-F8 cover ASR-only, manual+ASR, SPA nav, PO token, fallback, no-caption, no-regression. |
| T3 | Error states defined? | PASS | HIGH | F6 (PO token skip), F7 (fallback), A6 (no caption no-op). Gap: VTT parse-failure path not defined — see Risk #4. |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | PASS | HIGH | Objective states problem (timedtext URL matches 0 patterns → auto-load never triggers) before solution. |
| S2 | Out-of-scope ≥3 tempting extensions? | PASS | HIGH | 6 items: video download, Netflix/iQIYI, auto-translation, Whisper, manual import, transcript export. |
| S3 | Success metrics are measurable? | PASS | CRITICAL | F1-F8, NF1-NF6, A1-A7 all testable with concrete conditions. |

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | CRITICAL | Assumptions #9, Project Structure, F8 | **Adapter registry refactor of `subtitleDetector.ts` is based on a wrong premise.** Current `detectSubtitle(request: NetworkRequest)` receives only the subtitle URL + tabId — NO page origin. The spec says "dispatch by `new URL(tabUrl).hostname`" but `NetworkRequest` has no `tabUrl`, and the 2 callers (`networkInterceptor.ts:109`, `mediaDetection.ts:90`) pass only `NetworkRequest`. More fundamentally: YouTube timedtext URLs match **none** of `SUBTITLE_URL_PATTERNS` (no `.srt/.vtt/.ass` ext, no `/subtitles\|subs\|caption\|cc/` path) → `detectSubtitle` returns `null` for YouTube → YouTube detection is **proactive MAIN-world DOM parse**, bypassing `detectSubtitle()` entirely. The YouTube adapter in the registry would never be invoked via the network-interception path. The "no regression" claim (F8) is unverifiable because the refactor's invocation condition is undefined. | **Remove the adapter registry refactor from this spec** OR clearly split: (a) YouTube detection = proactive MAIN-world → `DETECTED_SUBTITLES` message (new path, does NOT touch `subtitleDetector.ts`); (b) generic detector stays 100% as-is. If a registry is desired for future Netflix/iQIYI, defer to a separate spec when the 2nd adapter actually lands (YAGNI — ponytail rung 1). Specify the new `DETECTED_SUBTITLES` message type + payload in `entities/message/types.ts`. |
| 2 | CRITICAL | Assumptions #2, NF6, Q1 | **MAIN↔ISOLATED bridge: spec contradicts an existing working pattern.** `manifest.json` already declares `fetchInterceptor.iife.ts` (`world: 'MAIN'`) which uses `window.postMessage({ type: '__DETECTED_SUBTITLE_FETCH', url })` → ISOLATED `content-script.ts:21-29` listens → relays `DETECTED_SUBTITLE_URL` to background. The spec's NF6 says "via `CustomEvent` (không pollute window properties)" — this **contradicts** the established `window.postMessage` bridge. Q1 defers this to G3 ADR, but it's a CRITICAL decision that gates the whole feature and has a working precedent. | Resolve in spec: adopt the existing `window.postMessage` pattern (consistency with `fetchInterceptor.iife.ts`). Define the message contract: `{ type: '__YT_DETECTED_SUBTITLES', tracks: CaptionTrack[], videoId: string }`. Acknowledge ADR-011 fetch-interceptor bridge as precedent. Drop NF6's `CustomEvent` lean or justify deviation. |
| 3 | CRITICAL | Assumptions #8, F7 | **InnerTube ANDROID client from content script is unfeasible as specified.** The ANDROID client context requires an ANDROID `User-Agent` header. `User-Agent` is a [forbidden header](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name) — `fetch` from a content script (MAIN or ISOLATED world) CANNOT set it. Without it, YouTube returns the WEB client response (which is the one that already failed / requires PO Token). The spec doesn't address this. | Route InnerTube fallback through the **background service worker** (which can use `fetch` with declarative header modification via `declarativeNetRequest`, or accept the WEB client response). Alternatively, drop the ANDROID client claim and use WEB-client InnerTube as fallback (still may hit PO Token, but honest about the constraint). Specify the fallback path: MAIN world → postMessage → ISOLATED → `sendMessage(INNERTUBE_FALLBACK_REQUEST)` → background `fetch`. |
| 4 | HIGH | Assumptions #1, Testing Strategy | **YouTube VTT standard-compliance not verified.** `parseVtt` (in `src/shared/lib/parsers/vttParser.ts`, NOT `subtitleParser.ts` as the research doc states) uses `stripSubtitleTags` from `srtNormalizer`. YouTube's `&fmt=vtt` output includes non-standard extensions: `<c.colorE5E5E5>` color tags, `<00:00:01.000>` inline timestamp tags, and `align:start position:0%` cue settings. If `stripSubtitleTags` doesn't handle `<c>` tags and inline timestamps, `parseVtt` will produce garbled cue text. The spec assumes "reuse parseVtt" without verifying. | Add a verification step: fetch a real YouTube VTT sample via edge-devtools MCP in G1 (before G2), run it through `parseVtt`, confirm cue text is clean. If `stripSubtitleTags` doesn't cover YouTube tags, add a YouTube-specific tag-stripping step (or a thin `parseYouTubeVtt` adapter). Add a test fixture `youtube-vtt-sample.vtt` with `<c>` + timestamp tags. |
| 5 | HIGH | Assumptions #3, F4, NF2 | **SPA navigation: ADR-010 pattern mismatch + race condition.** (a) ADR-010's `reportEpisodeChangedIfReplacement` fires on `<video>` element **identity change**. YouTube SPA nav (clicking another video) changes the URL via `pushState` but typically **reuses the same `<video>` element** (only `src` changes) → the ADR-010 watcher would NOT fire. (b) `yt-navigate-finish` fires after SPA nav, but the spec doesn't verify that `window.ytInitialPlayerResponse` is updated BEFORE the event fires — reading it too early returns the OLD video's tracks. | (a) Don't reuse `reportEpisodeChangedIfReplacement` for YouTube — use `yt-navigate-finish` (or `yt-page-data-updated` / `popstate` + `pushState` hook) as the primary SPA trigger, with `videoId` dedup. (b) Specify the read timing: listen `yt-navigate-finish` → then poll/wait for `ytInitialPlayerResponse` to reflect the new `videoId` (compare `playerResponse.videoDetails.videoId` against last-seen) before extracting tracks. Add this as an explicit step in the data flow. |
| 6 | HIGH | Assumptions #2, Project Structure | **Existing MAIN world script not acknowledged.** `manifest.json` already has `fetchInterceptor.iife.ts` (`world: 'MAIN'`, `run_at: 'document_start'`, `.iife.ts` suffix for CRXJS standalone bundle). The spec proposes a new `youtube-main-world.ts` without acknowledging the existing one or justifying a separate script vs extending it. Two MAIN world scripts both run `document_start` on `<all_urls>` — overhead + maintenance cost. | Acknowledge `fetchInterceptor.iife.ts`. Decide: (a) extend it with YouTube detection (single MAIN world script — ponytail), or (b) justify a separate script (e.g., YouTube-only `matches` to avoid overhead on non-YouTube pages). If separate, use `matches: ["*://*.youtube.com/*"]` instead of `<all_urls>`, and follow the `.iife.ts` CRXJS convention. |
| 7 | MEDIUM | Assumptions #6, F6 | **PO Token "skip + warn" silently drops tracks.** If ALL tracks require pot and InnerTube fallback fails (Risk #3), the user gets 0 subtitles with only `console.warn` — no user-visible feedback. For a language learner expecting auto-load, silent failure is poor UX. | Define a user-visible fallback state: toast "YouTube subtitles cần PO Token — không detect được" OR a badge in the manager panel. Add as F9 / A8. |
| 8 | MEDIUM | Project Structure, Research §3.2 | **`parseVtt` location misstated.** Research doc §3.2 and spec imply `parseVtt` lives in `src/features/subtitle/logic/subtitleParser.ts`. It actually lives in `src/shared/lib/parsers/vttParser.ts`; `subtitleParser.ts` is an adapter (`parseSubtitle`) that calls it. | Correct the reference in spec + research doc to `src/shared/lib/parsers/vttParser.ts`. |

## Open Questions

1. **(CRITICAL, must answer before G2)** Is the adapter registry refactor of `subtitleDetector.ts` actually needed, given YouTube detection is proactive MAIN-world and bypasses `detectSubtitle()`? Recommend dropping it (YAGNI) — confirm.
2. **(CRITICAL)** InnerTube ANDROID client: are you OK routing through the background SW (since content scripts can't set `User-Agent`), or should the fallback use WEB-client InnerTube only?
3. **(HIGH)** MAIN↔ISOLATED bridge: adopt the existing `window.postMessage` pattern (consistent with `fetchInterceptor.iife.ts`), or is there a concrete reason to prefer `CustomEvent`?
4. **(HIGH)** SPA trigger: confirm YouTube reuses the `<video>` element across SPA nav (verify via MCP) — if yes, ADR-010 element-replacement watcher is the wrong signal and `yt-navigate-finish` + `videoId` dedup is the primary trigger.
5. **(MEDIUM)** Extend existing `fetchInterceptor.iife.ts` with YouTube detection, or separate `youtube-main-world.ts` scoped to `*://*.youtube.com/*`?

## Suggested Spec Updates

1. **Assumptions #9 + Project Structure + F8**: Remove the `subtitleDetector.ts` adapter registry refactor OR rewrite it to clearly separate the two detection paths: (a) proactive MAIN-world → new `DETECTED_SUBTITLES` message (YouTube); (b) network-interception `detectSubtitle(NetworkRequest)` unchanged (generic). Add the new message type to `entities/message/types.ts` and `shared/config/messages.ts`. Drop the `genericSubtitleDetector.ts` extraction unless a second adapter is imminent.
2. **Assumptions #2 + NF6 + Q1**: Replace NF6's `CustomEvent` lean with `window.postMessage` (cite `fetchInterceptor.iife.ts` precedent). Define the MAIN→ISOLATED payload contract in the spec body (not deferred): `{ type: '__YT_DETECTED_SUBTITLES', tracks, videoId }`.
3. **Assumptions #8 + F7**: Specify InnerTube fallback routing: MAIN world → ISOLATED → `sendMessage` → background SW `fetch`. Drop the ANDROID `User-Agent` claim or move header modification to `declarativeNetRequest`. Add a constraint note: "content scripts cannot set forbidden headers (User-Agent)."
4. **Assumptions #1 + Testing Strategy**: Add a G1 verification step: fetch real YouTube VTT via MCP, run through `parseVtt`, confirm `stripSubtitleTags` handles `<c>` + `<00:00:01.000>` tags. Add fixture `tests/unit/features/detection/fixtures/youtube-vtt-sample.vtt`. Add test case: "YouTube VTT with `<c>` color tags → cue text stripped clean."
5. **Assumptions #3 + F4**: Replace "reuse `reportEpisodeChangedIfReplacement`" with: primary SPA trigger = `yt-navigate-finish` (+ `popstate`/`pushState` hook fallback); dedup by `playerResponse.videoDetails.videoId`; read `ytInitialPlayerResponse` AFTER event, poll until `videoId` changes from last-seen. Add an F4 sub-criterion: "re-detect fires only when `videoId` actually changes."
6. **Assumptions #6 + F6**: Add F9/A8 — user-visible feedback when all tracks skipped due to PO Token (toast or panel badge), not just `console.warn`.
7. **Project Structure**: Correct `parseVtt` path to `src/shared/lib/parsers/vttParser.ts`. Acknowledge existing `fetchInterceptor.iife.ts` MAIN world script; if adding `youtube-main-world.ts`, scope `matches` to `*://*.youtube.com/*` and use `.iife.ts` suffix.
8. **Project Structure**: The spec lists `src/entrypoints/background/index.ts # UPDATE — dispatch detectSubtitle with origin context` — this is wrong given Risk #1. Background should handle the new `DETECTED_SUBTITLES` message (new handler in `handlers/mediaDetection.ts` or new `handlers/youtubeDetection.ts`), not change `detectSubtitle` dispatch.

## Decision

- [ ] **APPROVED** — proceed to G2 Plan
- [x] **APPROVED_WITH_CONDITIONS** — answer the 2 CRITICAL open questions (#1, #2) + apply suggested updates #1-#3, then re-run spec-reviewer on the revised spec before G2
- [ ] **BLOCKED** — fix CRITICAL risks, re-run spec-reviewer

**Rationale for APPROVED_WITH_CONDITIONS (not BLOCKED):** All referenced files exist; the primary feature (MAIN-world proactive parse) is feasible and well-grounded in research; checklists pass 9/10. The 3 CRITICAL gaps (adapter registry premise, MAIN↔ISOLATED bridge contradiction, InnerTube User-Agent) are fixable in the spec without abandoning the approach — they require re-specifying the detection flow and fallback routing, not re-doing discovery. The spec should NOT proceed to G2 as-is, but a targeted revision addressing Risks #1-#3 + #5 unblocks it.
