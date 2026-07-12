# Spec Review: iQIYI Subtitle Detection

> **Model**: Opus 4.8
> **Date**: 2026-07-12
> **Spec**: `docs/specs/spec-iqiyi-subtitle-detection.md`
> **Intent**: `docs/intent/intent-iqiyi-subtitle-detection.md` (MISSING — intent derived from conversation: Anh yêu yêu cầu tải subtitle từ iq.com)
> **Reviewer**: spec-reviewer skill (subagent)

## Status

**APPROVED_WITH_CONDITIONS**

The spec is technically sound and heavily reuses the proven ADR-020 pattern, but several concrete code/contract bugs must be fixed before G4 implementation.

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|----|-------|
| Feasibility (Tech Lead) | 3 | 0 | 1 | F1-F4 |
| Testability (QA) | 3 | 0 | 0 | T1-T3 |
| Scope (Product) | 3 | 0 | 0 | S1-S3 |
| **Total** | 9 | 0 | 1 | |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | PASS | HIGH | No new external packages. Site-data dependency (`window.playerObject`) has fallback `[]` in `extractIqiyiStl`. Existing modules (`parseSrt`, `fetchAndParseSubtitle`, `findSubtitlesForOverlay`, `pushAutoLoadSubtitles`, `downloadSubtitle`/`downloader.ts`) are owned. |
| F2 | Architecture considerations section exists? | PASS | MEDIUM | Architecture + ADR-028 + project structure + data flow. |
| F3 | Technical constraints reviewed? | PASS | HIGH | MV3 `world: 'MAIN'`, CORS/Referer, credentials, SPA navigation, polling, `declarativeNetRequest`. |
| F4 | Rollback strategy for stateful changes? | NA | HIGH | No storage/schema migrations; all changes are in-memory modules + manifest. |

### Testability (QA)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | PASS | CRITICAL | Success Criteria list concrete: `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, MCP browser verify. |
| T2 | Edge cases ≥2 per user story? | PASS | HIGH | Unit tests cover empty input, AI (`ss:1`), unknown `lid`, malformed `playerObject`, missing `srt`/`lid`; integration tests cover SPA nav and free/VIP content. |
| T3 | Error states defined? | PASS | HIGH | Fetch/parse failure → toast + fallback; unknown `lid` → skip + warn; missing `playerObject` → `[]`; CORS → background DNR fallback; 0 tracks → overlay clear. |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | PASS | HIGH | Objective describes the problem (generic URL-pattern detector cannot match iQIYI manifest URLs) and success outcomes, not a UI solution. |
| S2 | Out-of-scope ≥3 tempting extensions? | PASS | HIGH | `Boundaries / Never` lists 5 items: no generic-detector refactor, no adapter registry, no WASM encryption, no URL building, no manual Referer setting. |
| S3 | Success metrics are measurable? | PASS | CRITICAL | Concrete test/lint/browser outcomes and subtitle counts (12 free, 11 VIP). |

## Key Findings

### Code References

- `src/entrypoints/background/messageBus.ts:32` — `this.handlers.set(type, handler)` overwrites previous handlers. This makes the `DETECTED_SUBTITLES` unification mandatory.
- `src/entrypoints/background/index.ts:218` — currently calls `registerYouTubeDetectionHandlers(this)`, which registers `DETECTED_SUBTITLES`. If `detectionDispatch.ts` is added without removing the YouTube registration, one handler overwrites the other.
- `src/entrypoints/background/handlers/youtubeDetection.ts:37-109` — the existing `DETECTED_SUBTITLES` handler must be moved to `detectionDispatch.ts`; `youtubeDetection.ts` should keep only `INNERTUBE_FALLBACK_REQUEST`.
- `src/entrypoints/content/content-script.ts:18` — posts `__YT_CS_READY` but does **not** post `__IQ_CS_READY`. The `iqiyi-main-world.iife.ts` handshake relies on this post.
- `src/entrypoints/content/content-script.ts:65-90` — handles `__YT_DETECTED_SUBTITLES` relay; an analogous `__IQ_DETECTED_SUBTITLES` relay branch is needed.
- `src/entrypoints/content/content-script.ts:1016-1065` — `AUTO_LOAD_SUBTITLES` with `target`/`native` `null` clears the overlay, satisfying the SPA clear requirement.
- `src/entities/message/types.ts:452-456` — `DetectedSubtitlesPayload` requires `videoId` and has no `source`, `tvid`, or `origin` fields. The iQIYI payload uses `tvid`/`origin` and omits `videoId`.
- `src/entities/media/types.ts:12-38` — `DetectedSubtitle` already has `isAsr`, `displayName`, and `initiator` (ADR-020), so no entity change is needed.
- `src/features/subtitle/service/subtitleService.ts:31-83` — `findSubtitlesForOverlay` uses `isAsr` and `initiator`, which the iQIYI mapper already supplies.
- `src/features/download/downloader.ts:327` — `downloadSubtitle` uses `subtitle.initiator` for DNR Referer; iQIYI `initiator` must be set to `https://www.iq.com/`.
- `src/features/subtitle/logic/subtitleAutoLoad.ts:120` — `fetchAndParseSubtitle` passes `initiator` to the background fallback, which is correct for the CORS/Referer path.
- `src/entrypoints/background/networkInterceptor.ts:271` — `addDetectedSubtitles` deduplicates by `url`, which is fine because iQIYI SRT URLs include per-episode hashes.
- `src/entrypoints/background/handlers/subtitle.ts:123` — `FETCH_SUBTITLE_CONTENT` uses `payload.initiator ?? tabUrl` for DNR Referer.
- `src/entrypoints/background/helpers.ts:433` — `pushAutoLoadSubtitles` consumes `DetectedSubtitle[]` and uses `findSubtitlesForOverlay`; iQIYI tracks flow through it unchanged.
- `public/manifest.json:22-45` — `content_scripts` currently has only `content-script.ts`, `fetchInterceptor.iife.ts`, and `youtube-main-world.iife.ts`; the new `iqiyi-main-world.iife.ts` entry is missing.
- `src/features/detection/index.ts:1-43` — will need `iqiyiSubtitleDetector` exports added.
- `src/shared/lib/parsers/srtParser.ts:20` — `parseSrt` already handles standard SRT with CRLF/BOM/sequential numbering, so iQIYI SRT can be parsed directly.
- `docs/intent/intent-iqiyi-subtitle-detection.md` — missing; intent is derived from conversation context.

### ADR-028 Contract Bugs

- Contract 5 `iqiyi-main-world.iife.ts`:
  - `__IQ_CS_READY` listener uses `if (event.source !== window && event.data?.type === '__IQ_CS_READY' ...)` — this is inverted. It should guard `event.source !== window` with an early return, then check `event.data?.type === '__IQ_CS_READY'`.
  - `detect()` sets `lastTvid = tvid` **before** `extractIqiyiStl(playerObject)`. If `playerObject` is available but `stl` is not yet loaded, the next poll is deduplicated and the subtitles are never reported.
  - `detect()` is declared `async function detect(): Promise<void>` but returns `tracks.length > 0` (a `boolean`). The return type should be `Promise<boolean>` (or the polling stop should be driven by a side effect).
  - `origin + entry.srt` concatenation can produce a double slash if `data.dstl` contains a trailing slash. Use `new URL(entry.srt, origin).href`.

### Type / Payload Contract

- The iQIYI content-script relay payload `{ tracks, tvid, source: 'iqiyi', origin, tabId: undefined }` does not satisfy `DetectedSubtitlesPayload` because `videoId` is required.
- Suggested update to `DetectedSubtitlesPayload` in `src/entities/message/types.ts`:
  - Make `videoId` optional.
  - Add `source?: 'youtube' | 'iqiyi' | string`.
  - Add `tvid?: string` and `origin?: string`.

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | CRITICAL | Feasibility | `messageBus.on` (`messageBus.ts:32`) overwrites `DETECTED_SUBTITLES` handlers. Adding `youtubeDetection.ts` and `detectionDispatch.ts` without care will break YouTube. | In `index.ts`, register only `detectionDispatch.ts` for `DETECTED_SUBTITLES`; keep `youtubeDetection.ts` only for `INNERTUBE_FALLBACK_REQUEST`. Verify `youtubeDetection.ts` no longer registers `DETECTED_SUBTITLES`. |
| 2 | HIGH | Feasibility | `content-script.ts:18` posts `__YT_CS_READY` but never `__IQ_CS_READY`; `iqiyi-main-world.iife.ts` listens for `__IQ_CS_READY`. | Add `window.postMessage({ type: '__IQ_CS_READY', time: csInjectTime }, '*');` after the YouTube handshake in `content-script.ts`. |
| 3 | HIGH | Feasibility | `__IQ_CS_READY` listener in ADR-028 Contract 5 uses `event.source !== window &&`, so it never fires for the same-page content-script handshake. | Mirror YouTube: `if (event.source !== window) return;` then `if (event.data?.type === '__IQ_CS_READY' && ...)`. |
| 4 | HIGH | Feasibility | `detect()` sets `lastTvid` before `extractIqiyiStl()`; if `stl` is missing on first poll, the same `tvid` is never re-polled. | Move `lastTvid` assignment to after `extract` succeeds, or set it only when `tracks.length > 0` while still posting the 0-track clear on actual empty `stl`. |
| 5 | MEDIUM | Feasibility | `detect()` declared `Promise<void>` but returns `boolean` in the ADR contract code. | Change return type to `Promise<boolean>` or rewrite `startPolling` to stop via a side-effect flag. |
| 6 | MEDIUM | Feasibility | `DetectedSubtitlesPayload` (`message/types.ts:452`) requires `videoId` and lacks `source`/`tvid`/`origin`. | Update the payload interface to make `videoId` optional and add `source`, `tvid`, and `origin` fields. |
| 7 | MEDIUM | Feasibility | `mapIqiyiSubtitleTracks` uses `origin + entry.srt` string concat; `data.dstl` may have a trailing slash. | Use `new URL(entry.srt, origin).href` in `iqiyiSubtitleDetector.ts`. |
| 8 | MEDIUM | Testability | Browser verify depends on live iq.com free + VIP content; `qd_tm` TTL is an open question (ADR-028 open question #1). | Add a BUILD test for URL expiration and a re-extract manifest fallback before download. |
| 9 | LOW | Scope | `docs/intent/intent-iqiyi-subtitle-detection.md` is missing. | Create the intent file or keep a permanent note in the spec. Not a blocker. |

## Open Questions

1. Will `content-script.ts` post `__IQ_CS_READY` in addition to `__YT_CS_READY`?
2. What is the exact `data.dstl` value (scheme, host, trailing slash)? Should `mapIqiyiSubtitleTracks` use `URL` resolution?
3. Is `playerObject.stl` guaranteed to exist as soon as `playerObject` is available, or can `tvid` appear before `stl`?
4. Does the current `declarativeNetRequest` rule cover `meta.video.iqiyi.com` and other iQIYI CDN hostnames?
5. Should `DetectedSubtitlesPayload` include a `source` discriminator, and should `videoId` be optional for iQIYI?
6. Should the YouTube `__YT_DETECTED_SUBTITLES` relay add `source: 'youtube'` for explicit dispatch, or keep `source` undefined for backward compatibility?
7. How will `subtitleOverlayAutoLoadAsr` default affect users on iQIYI where AI tracks (FR/KO/JP/ES/DE) are common? Badge still displays, but auto-load may skip them.

## Suggested Spec Updates

1. Add `__IQ_CS_READY` handshake post to `src/entrypoints/content/content-script.ts` (after `__YT_CS_READY`).
2. Fix the `__IQ_CS_READY` listener guard in `src/entrypoints/content/iqiyi-main-world.iife.ts` (mirror `youtube-main-world.iife.ts`).
3. Fix the `detect()` ordering and return type in `src/entrypoints/content/iqiyi-main-world.iife.ts`.
4. Update `src/entities/message/types.ts` `DetectedSubtitlesPayload` to support `source`, `tvid`, `origin`, and optional `videoId`.
5. Use `new URL(entry.srt, origin).href` in `src/features/detection/logic/iqiyiSubtitleDetector.ts`.
6. Add `iqiyi-main-world.iife.ts` content-script entry to `public/manifest.json`.
7. Export `iqiyiSubtitleDetector` from `src/features/detection/index.ts`.
8. Update `docs/2-architechture-system.md` with the new files and detection path.
9. Create or explicitly omit `docs/intent/intent-iqiyi-subtitle-detection.md`.
10. Add `qd_tm` expiration handling to the spec or keep as a BUILD open question with explicit exit criteria.

## Decision

- [ ] **APPROVED** — proceed to G2 Plan
- [x] **APPROVED_WITH_CONDITIONS** — fix the CRITICAL/HIGH risks and answer the open questions, then proceed to G2
- [ ] **BLOCKED** — fix CRITICAL risks, re-run spec-reviewer

**Conditions for G2**:

1. Resolve the `messageBus` handler overwrite risk by confirming `detectionDispatch.ts` is the only `DETECTED_SUBTITLES` registrant.
2. Implement/fix `__IQ_CS_READY` handshake in both `content-script.ts` and `iqiyi-main-world.iife.ts`.
3. Fix `detect()` `lastTvid` ordering and return type in `iqiyi-main-world.iife.ts`.
4. Update `DetectedSubtitlesPayload` and `iqiyiSubtitleDetector` URL construction.
5. Add `manifest.json` and `src/features/detection/index.ts` updates to the spec.
