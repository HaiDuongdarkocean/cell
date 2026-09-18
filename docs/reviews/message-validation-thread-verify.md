# Delivery Verification: message-validation-thread

Spec under test: `docs/specs/message-validation-thread.md` — verified against repo code, not the item description.

## AC-1 — DETECTED_SUBTITLES per-branch validation — PASS

- Envelope: `detectionDispatch.ts:49` `DetectedSubtitlesPayloadSchema.safeParse(request.payload)`; failure → `{success:false}` :50-52. No envelope cast.
- Per-branch array safeParse before mappers: iqiyi :64 → `mapIqiyiSubtitleTracks` :68; netflix :75 → :79; else-branch (`source==='youtube'` or absent) :85 → `mapYouTubeCaptionTracks` :89. Malformed arrays return `{success:false}` :66/:77/:87 — before `addDetectedSubtitles` (:127) and before the overlay-clear branch (:95-125).
- `tracks:[]` passes → `subtitles.length===0` → overlay-clear still runs (:95-124).
- Zero `as` casts in file (`satisfies` on outbound payloads is not a cast).
- Schemas (`trackSchemas.ts`) mirror `YouTubeCaptionTrack`/`IqiyiSubtitleTrack`/`NetflixSubtitleTrack` verbatim; barrel-exported `features/detection/index.ts:34-41`; default-strip, no `.strict()`. Producers emit raw objects (youtube-main-world.iife.ts:240-246; iqiyi-main-world.iife.ts:170; netflix-main-world.iife.ts:195-204,229); relays add `source` only for iq/nf (subtitleBridges.ts:113-193).

## AC-2 — SUBTITLE_CUES_LOADED — PASS

- `bilingualCueSchema` schema.ts:114-120 mirrors `BilingualCue` (entities/media/types.ts:90-96); `cues: z.array(bilingualCueSchema)` :124.
- `subtitle.ts:163-164` uses `parsed.data.cues`, no cast; feeds `ctx.lastCuesByTab` (:168) + bg relay (:175-178).

## AC-3 — RESOLVE_SUBTITLE_DOWNLOAD — PASS

- `subtitleDownloadKindSchema` discriminated union :223-226; `subtitleSearchResultSchema` :228-241 mirrors `SubtitleSearchResult` (searchTypes.ts:19-38) incl. optionals; used at :244.
- `subtitleSearch.ts:166-177` uses `parsed.data.result`; `const provider = result.source` — `as unknown as` and `result.source as` both removed.
- Out-of-scope residue: `providerId as SubtitleApiKeyProvider` :71 (internal `pickProviderOrder()` output, not payload).

## AC-4 — UPDATE_SETTINGS sanitization — PASS (residuals applied)

- `settings` → `z.record(z.string(), z.unknown())` (schema.ts:45-47); non-record fails envelope.
- `settingsPatch.ts` dispatch correct: `schemaVersion` always dropped; `activeProfileId` `null|string`; `subtitleApiKeys` element-checked incl. provider/status enums + `addedAt`; record/string rules; rules-table keys win over `DEFAULT_SETTINGS` membership. `SETTINGS_ENUM_FIELDS` matches all 7 union types.
- `settings.ts:38-55` merges only sanitized `patch`; four eager setters read `patch.*` — dropped keys never fire setters.
- All legit senders pass: popup full `Settings` (App.redesigned.tsx:253-256), cs `{dictionaryPopup}` partials (popupLifecycle.ts:213-220, orbitalBadgeSync.ts:48-51), e2e `{activeProfileId, languageProfiles, srs}` (extension-ocean-srs.spec.ts:22-32).
- **Applied post-review:** prototype-chain lookups hardened — `Object.hasOwn` on both `SETTINGS_PATCH_RULES` and `DEFAULT_SETTINGS` dispatch (verifier flagged accidental fail-closed on `__proto__`; now deliberate).
- **Residual (minor):** `Number.isFinite` allows fractions on integer keys (`concurrentDownloads: 1.7` persists; floored/clamped at runtime). Scoped to non-finite per spec review; flagged for follow-up.
- Coverage notes: no explicit `source:'youtube'` test; no fraction-on-integer-key test (feature absent).

## AC-5 — LOOKUP_REQUEST — PASS

- `lookupRequestSchema` (dictionarySchemas.ts:373-379) mirrors `LookupRequest` (entities/dictionary/types.ts:84-92) verbatim — plain `z.string()`/`z.number()`, optional `fallback`; divergence from stricter `LookupRequestSchema` (:26-32) documented in-file. `LookupRequestPayloadSchema.request` uses it (:383); zero `z.custom` remains in `entities/message/`.
- `lookup.ts:27-36` destructures `parsed.data`, no cast. Sender `{requestId, request}` (popupLifecycle.ts:488-491) matches; bus-injected `tabId` stripped harmlessly.

## AC-6 — zero casts on validated data — PASS

- `payload.\w+ as ` / `request.payload as` / `as unknown as` — zero hits in the five handlers. Remaining hits: test-file `ctx as unknown as` mocks + `ocr.ts` offscreen-type casts (unrelated). `subtitle.ts:57` `(existing as DetectedSubtitle)` is on a `mediaMap` entry, not payload — pre-existing.

## AC-7 — tests & fixtures — PASS

- `trackSchemas.test.ts` — producer-faithful fixtures incl. extra keys, strip assertion, all-or-nothing reject, `[]` accept.
- `settingsPatch.test.ts` — unknown/mistyped/enum/schemaVersion drops, `activeProfileId` null|string, element checks, non-finite drops, container-kind swaps, undefined skip.
- `detectionDispatch.test.ts` — malformed envelope, absent-source→yt, iq/nf branches, malformed-tracks rejected before `addDetectedSubtitles`, unknown source, `[]`→overlay-clear.
- `settings.test.ts` — merge + eager setters, drop-before-save with setter suppression, `activeProfileId` string, non-record envelope.
- `schema.test.ts` — cue + result (direct+handshake) accept/reject; `dictionarySchemas.test.ts:652-696` — lookup accept incl. >2000-char contextSentence + malformed reject.
- `integration.test.ts` cue fixtures match real `BilingualCue` (:2309, :2333, :2453, :2473); UPDATE_SETTINGS fixture :724.

## AC-8 — gates — PASS

- `pipeline-state.json` records typecheck/lint/testUnit/build all pass 21:28-21:33Z; `Object.hasOwn` hardening re-verified by unit tests post-edit. Static review clean: no `any`, correct zod v4 APIs (4.6.5), single sanctioned boundary cast. `docs/2-architechture-system.md` updated (:430, :972, :1439) — DoD satisfied.

## Regression checks

- Bus envelope-parses + injects `tabId` pre-validation (messageBus.ts:37-48, 137-147); handler re-parse matches codebase pattern.
- Single DETECTED_SUBTITLES registrant; `youtubeDetection.ts` only registers INNERTUBE_FALLBACK_REQUEST — no duplicate-registration throw.
- `z.record` vs old `z.custom` for UPDATE_SETTINGS: all senders emit object records; arrays/null fail closed — intended.
- Other schema consumers: registry + handlers only. Side-panel raw `onMessage` cue listener unvalidated — spec-bounded follow-up. Direct `saveSettings`/`chrome.storage` writes bypass — spec-scoped out.

VERDICT: PASS
