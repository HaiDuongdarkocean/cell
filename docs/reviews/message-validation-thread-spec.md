# Spec Review: message-validation-thread

Reviewers: 3 independent lenses (code-verify REQ-1/2/3/5; REQ-4 deep-dive; template/rubric) + orchestrator spot-checks. Evidence verified against repo HEAD.

## Verified-true load-bearing claims

- Bus auto-validates every registered handler and hands off `parsed.data` (`messageBus.ts:37-49`); all five types have registry schemas (`registry.ts:188,284,344,512,548`); `tabId` injection happens pre-validation (`messageBus.ts:137-146`).
- All cast sites real: `detectionDispatch.ts:49,61,68,74`; `subtitle.ts:165`; `subtitleSearch.ts:174`; `dictionarySchemas.ts:372` `z.custom<LookupRequest>`; `settings.ts:31-56` merge + eager setters.
- Interfaces zod-expressible: `YouTubeCaptionTrack`/`IqiyiSubtitleTrack`/`NetflixSubtitleTrack`, `BilingualCue` (`entities/media/types.ts:90-96`), `LookupRequest` (`entities/dictionary/types.ts:84-92`), `SubtitleDownloadKind` discriminated union (`entities/subtitle/searchTypes.ts:19-21`).
- Producer shapes compatible with zod default-strip: Netflix emits exact shape (`netflix-main-world.iife.ts:196-204,223-230`); cues emit exact `{index,start,end,targetText,nativeText}`; search results exact-shape; lookup producers omit `fallback` (optional needed).
- `DEFAULT_SETTINGS` at `config.ts:258-314`; `Settings` at `entities/settings/types.ts:328-459`; `z.record` vs `z.custom` envelope behavior equivalent for senders (zod v4, `schema.ts:47`).

## Blocker

**B1 — REQ-4 drops legit `activeProfileId` patches (null-default trap).**
- Claim: rule "defaulted keys: `Array.isArray` → array check; non-null object → record check; else `typeof` equality" (spec :75) breaks on the only null default.
- Evidence: `DEFAULT_SETTINGS.activeProfileId = null` (`config.ts:262`), type `string | null` (`types.ts:342`). `typeof null === 'object'` → string patch fails typeof equality → silently dropped. Legit sender: `LanguageProfilePanel.tsx:84` `onChange({...settings, activeProfileId: id})` → `SettingsDialogContent.tsx:261` → `App.redesigned.tsx:253-256` → `UPDATE_SETTINGS`. Dropped patch → handler merges stale value → `saveSettings` RMW (`settingsStore.ts:667-675`) can clobber the panel's racing direct write. Violates NFR-3 "every legit current payload passes".
- Verdict: **defect**. Fix: special-case nullable defaults — `value === null || typeof match` (or declare `activeProfileId` in a nullable-keys constant).

## Major

**M1 — REQ-4 `OPTIONAL_SETTINGS_KEYS` premise factually wrong; validator dispatch ambiguous.**
- Spec :74 defines the list as "Settings keys absent from defaults", but 9 of 11 listed keys ARE in `DEFAULT_SETTINGS` (`defaultSubtitleLanguage` :265, `subtitleOverlayTargetStyle` :287, `subtitleOverlayNativeStyle` :288, `subtitlePreference` :289, `subtitleOffset` :299, `dictionaryPopup` :303, `subtitleApiKeys` :305, `pronunciation` :307, `frequencyBands` :309); only `subtitlePreview{Target,Native}Text` are truly absent. Rules :75 (defaulted → container/typeof) vs :76 (optional → coarse validators) conflict on the overlap: if `key in DEFAULT_SETTINGS` dispatches first, `subtitleApiKeys` gets bare `Array.isArray` — the intended api-key element check never runs (`[42]` persists; not self-healed).
- Verdict: **defect**. Fix: correct premise; specify per-key dispatch (listed keys use their coarse validator regardless of defaults membership).

**M2 — `defaultQuality` missing from `SETTINGS_ENUM_FIELDS`; self-heal postcondition overstated.**
- `defaultQuality: VideoQuality` is a 7-value string union (`types.ts:344`, `VideoQualitySchema` `schema.ts:12-20`) absent from the enum list (spec :75). `defaultQuality: 'bogus'` passes typeof → persists forever: `coerceDefaultTypes`/`mergeNestedObjectDefaults` (`settingsStore.ts:543-645`) only repair type mismatches, never same-type wrong values; no `validate*` covers it. Contradicts postcondition "persisted garbage still self-heals" (spec :78).
- Verdict: **defect**. Fix: add `defaultQuality` to enum fields; narrow self-heal claim to container-kind mismatches.

**M3 — REQ-4 omits `resolveSettingsFlatFields` inside `saveSettings`: the cited actors' patches are discarded downstream.**
- `saveSettings` calls `resolveSettingsFlatFields` (`settingsStore.ts:674` → `profileResolution.ts:81-88,150-169`) which overwrites `subtitleOverlayAutoLoad*`/`subtitleOverlay*Style`/`dictionaryPopup`/languages from the active profile when `activeProfileId` resolves (all migrated users). The `dictionaryPopup` partials from `popupLifecycle.ts:213-220` / `orbitalBadgeSync.ts:48-51` — the very actors spec :64 cites — are sanitized, merged, then silently overwritten. Pre-existing behavior, but REQ-4's goal/AC-4 ("merge into persisted settings") is false as spec'd for flat fields.
- Verdict: **defect (documentation/scope)**. Fix: document the override in REQ-4 and specify whether handler syncs patched flat fields into the active profile or senders must patch `languageProfiles`.

**M4 — REQ-1 under-specifies strip-vs-strict + all-or-nothing semantics on raw page objects.**
- YouTube `tracks` are raw InnerTube `captionTracks` (`youtube-main-world.iife.ts:110-111,240-246`); iQIYI tracks are raw `stl[]` (`iqiyi-main-world.iife.ts:123-138`) — both carry extra keys. "Mirror interfaces exactly" (spec :34) under a `.strict()` reading rejects every legit payload → total detection regression. Also: today malformed elements degrade per-track (`iqiyiSubtitleDetector.ts:146-151`, `youtubeSubtitleDetector.ts:147-152`); array-level fail-closed converts one bad element into zero subtitles AND skips the empty-tracks overlay-clear branch (`detectionDispatch.ts:79-108`) — unacknowledged behavior change on the most-used path.
- Verdict: **under-specified, high blast radius**. Fix: state zod default-strip explicitly; record the all-or-nothing vs per-element decision in Rules.

**M5 — REQ-2 postcondition overclaims: panel relay is not protected.**
- "only `BilingualCue`-shaped cues enter `ctx.lastCuesByTab` and the panel relay" (spec :40) — but the side panel listens raw via `onMessage` (`sidepanel/App.tsx:77-92`); a forged cs broadcast with matching `tabId` bypasses background validation entirely (sendMessage fans out to all extension contexts).
- Verdict: **overclaim**. Fix: scope postcondition to `lastCuesByTab` + bg-relayed copy, or note panel-side trust boundary as follow-up.

**M6 — REQ-5 wrong file path + unacknowledged near-duplicate schema + interface narrowing.**
- Spec :89 cites `src/entities/dictionary/dictionarySchemas.ts:372`; actual is `src/entities/message/dictionarySchemas.ts:370-373` (no such file under `entities/dictionary/`). Same file already contains a stricter `LookupRequestSchema` (`dictionarySchemas.ts:27-33` — `term` max(200), `langCode` length(2), `contextSentence` max(2000)); spec adds a second looser schema without reuse analysis — producers emit unbounded `contextSentence`/`term` so reuse would break legit lookups, but the divergence must be stated. `cursorOffset: int().min(0)` and `term/langCode: min(1)` also narrow beyond the interface's plain `number`/`string` (NFR-3 "mirror verbatim" tension).
- Verdict: **defects (factual + missing analysis)**. Fix path; justify new schema vs existing; align or justify bounds.

**M7 — Template compliance gaps (rubric-mandated fields/sections missing).**
- Missing Preconditions: REQ-3/4/5. Missing Alt flows (or explicit "none"): REQ-2/3/5. `## Definition of Done` section absent entirely (template :88-94). No alternatives-considered note (TL rubric requires ≥2 rejected alternatives — e.g. strict `Partial<Settings>` zod schema vs sanitizer; discriminated-union envelope vs per-branch parse). REQ-4 deviates from intent AC4's "validates a `Partial<Settings>` shape" without recording the deviation; sanitizer's single output cast contradicts "zero casts" claims in spirit (relocated, not eliminated).
- Verdict: **non-compliance**. Fix: add fields/sections; record AC4 deviation in Traceability.

## Minor

- `subtitleSearch.ts:178` `result.source as SubtitleApiKeyProvider` — residual cast on validated data survives AC-6's grep pattern (harmless post-tightening).
- `searchTypes.ts` header declares "Pure types only, no logic" (:1-15) — placing runtime schemas there violates its own convention; `export type *` re-export (`features/subtitle/logic/subtitleSearchTypes.ts:1`) won't carry them.
- `trackSchemas.ts` barrel export unspecified (handler imports via `@/features/detection`).
- REQ-1 envelope-parse ownership ambiguous — bus already safeParses; handler re-parse is consistent with existing pattern but should be stated.
- Error-response shape inconsistent: REQ-1 specifies `error` field, REQ-2/3/5 don't.
- Sanitized message path isn't the only persist path — direct `saveSettings`/`chrome.storage.local` writes from cs/panel bypass (`mountUniversalPanel.ts:262`, `contentScriptController.ts:914`, `reactSubtitleController.ts:276`); worth one scoping sentence.
- Nested-map keys (`subtitlePreference`, `subtitleOffset`) are replace-not-merge under shallow merge — document "send whole nested objects" rule.
- Non-finite/fractional numbers pass typeof (`concurrentDownloads: 2.5`/`Infinity` persist un-clamped).
- REQ-4 step 4 doesn't state apply-if-present for the four eager keys (dropped mistyped key → setter must not fire).
- Exception flows cover validation only; `saveSettings` rejection / `plugin.tokenize` throw preservation unstated.
- Cosmetics: SC numbered list vs template `- [ ]`; mixed `src/` path prefixes; Accepted Risks not carried from intent; F↔F row 2 lists constraints not features; NFR-2 orphan.

## Action items (required before implement)

1. REQ-4: special-case null-default keys (`activeProfileId`) — accept `null | declared type`. (B1)
2. REQ-4: fix OPTIONAL_SETTINGS_KEYS premise; explicit per-key validator dispatch so `subtitleApiKeys` keeps element-shape check. (M1)
3. REQ-4: add `defaultQuality` to SETTINGS_ENUM_FIELDS; narrow self-heal postcondition; document `resolveSettingsFlatFields` override + apply-if-present for eager keys. (M2/M3)
4. REQ-1: state zod default-strip; record all-or-nothing array decision. (M4)
5. REQ-2: scope postcondition to cache + bg-relayed copy. (M5)
6. REQ-5: fix path to `entities/message/dictionarySchemas.ts`; justify divergence from existing `LookupRequestSchema`; align or justify `min(1)`/`int()` bounds. (M6)
7. Template: add missing Preconditions/Alt flows, Definition of Done, rejected-alternatives note, AC4-deviation record. (M7)

## Risks accepted

- Sanitizer-over-strict-schema for settings: sound; lossy merge is required by legit senders.
- Double envelope-parse in REQ-1 handler: harmless duplication matching existing handlers.
- Direct-write `chrome.storage` bypass: inherent MV3 permission model; out of scope for message-boundary hardening.

VERDICT: APPROVE_WITH_CHANGES
## Applied fixes (author pass, post-review)

- B1: `activeProfileId` special-cased in `SETTINGS_PATCH_RULES` — `null | string`, never bare `typeof` (REQ-4 Rules + SC-4).
- M1: `OPTIONAL_SETTINGS_KEYS` premise replaced by per-key dispatch table `SETTINGS_PATCH_RULES` — listed keys use their validator regardless of `DEFAULT_SETTINGS` membership; `subtitleApiKeys` keeps element check.
- M2: `defaultQuality` added to `SETTINGS_ENUM_FIELDS`; self-heal postcondition narrowed to container-kind mismatches.
- M3: `resolveSettingsFlatFields` flat-field override documented in REQ-4 postcondition; eager setters now apply-if-present (REQ-4 step 4).
- M4: zod default-strip stated; all-or-nothing array decision + rejected per-element alternative recorded; `tracks:[]` → overlay-clear preserved.
- M5: REQ-2 postcondition bounded to `lastCuesByTab` + bg broadcast; panel raw-listener noted as follow-up.
- M6: path fixed to `entities/message/dictionarySchemas.ts`; existing stricter `LookupRequestSchema` divergence justified; bounds aligned to verbatim interface.
- M7: Preconditions added (REQ-3/4/5); Alt flows recorded (REQ-2/3/5 "none"); `## Definition of Done` added; rejected-alternatives note; AC4 deviation recorded in Traceability; `result.source as` cast added to REQ-3 postcondition; schemas relocated to `entities/message/schema.ts` (searchTypes.ts is pure-types); `trackSchemas.ts` barrel export stated; envelope re-parse rationale stated; error shape unified; direct-write bypass scoped; non-finite numbers dropped; `resolveSettingsFlatFields` + replace-not-merge documented.
