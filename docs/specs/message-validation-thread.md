# Spec: message-validation-thread

> Intent: `docs/intent/message-validation-thread.md` · ui_surface: no · Mode: all

## Objective

Close the shape-validation gap on the inbound message boundary: `MessageBus.on()` already wraps every handler with the registry envelope schema, but five payload fields are declared as `z.unknown()`/`z.record()`/`z.custom()` and handlers bridge the gap with `as` casts — malformed tracks/cues/results/settings/lookup payloads reach mappers, caches, relays, persisted settings, and the lookup orchestrator. Tighten the five fields to real schemas (or a boundary sanitizer for the settings patch) so malformed shapes fail closed with `{success:false}` and zero `as` casts remain on validated data. This is crash-resistance/integrity hardening — a *well-shaped* hostile payload still passes (shape ≠ trust); content-level forgery is a separate concern documented as follow-up.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Content script / MAIN-world relay | sends `chrome.runtime` message | message payload | `MessageResponse` |
| Hostile page JS | posts `__YT/__IQ/__NF_DETECTED_SUBTITLES` to `window` | forged tracks array | nothing (relay is one-way) |
| Extension UI (popup/panel/dialogs) | sends `UPDATE_SETTINGS`, `LOOKUP_REQUEST` | settings patch, lookup request | response with merged settings / lookup result |

System-internal: validation, mapping, caching, persisting — no human behavior inside flows.

## Requirements

### Functional

REQ-1: Per-source detection track validation
- Actor: content script (or page JS via the postMessage relay)
- Goal: detected subtitle tracks reach the mappers only when well-formed
- Preconditions: `MessageBus` registered; `DETECTED_SUBTITLES` handler installed
- Basic flow:
  1. actor sends `DETECTED_SUBTITLES` with `{tracks, source?, tabId?}`
  2. system envelope-validates via `DetectedSubtitlesPayloadSchema` (unchanged envelope — `z.array(z.unknown())` stays; `source` enum absent → YouTube branch). The bus already envelope-parses; the handler re-parses for typed `parsed.data` — same pattern as every other handler
  3. system safeParses `payload.tracks` against the per-source track-array schema (`iqiyi`/`netflix`/`youtube`)
  4. system maps typed tracks → stores → broadcasts (existing flow unchanged)
- Alt flow: `source` absent → YouTube branch (backward compat, ADR-020); an *unknown* `source` string fails the envelope enum (by design, unchanged); `tracks: []` (valid empty array) still reaches the mapper → `[]` → existing zero-subtitles overlay-clear branch (`detectionDispatch.ts:79-108`) is preserved
- Exception: envelope invalid OR track array invalid → `{success:false, error:'Invalid …'}` — no mapper call, no store write, no broadcast, and the overlay-clear branch does NOT run (a forged/corrupt array must not clear a working overlay state; legit empty states arrive as `[]`, which passes)
- Rules:
  - Track schemas live in `src/features/detection/logic/trackSchemas.ts`, exported via the `features/detection` barrel; they mirror the producer interfaces (`YouTubeCaptionTrack`, `IqiyiSubtitleTrack`, `NetflixSubtitleTrack`)
  - **Zod default-strip, not `.strict()`** — YouTube emits raw InnerTube `captionTracks` and iQIYI raw `stl[]` objects carrying extra keys; schemas validate required fields and strip the rest. Netflix emits the exact shape already
  - **All-or-nothing array validation** — one malformed element fails the whole `tracks` array → `{success:false}`. Decision recorded: per-element filtering was rejected because silent partial drops hide producer bugs; the elements' old lenient-skip behavior is replaced by boundary rejection
  - The handler envelope cast `request.payload as DetectedSubtitlesPayload` is removed in favor of `safeParse` → `parsed.data`
- Postcondition: malformed tracks never reach `map*SubtitleTracks`; zero `as` casts in the handler
- NFR refs: NFR-1, NFR-2, NFR-3

REQ-2: `SUBTITLE_CUES_LOADED` cue validation
- Actor: content script
- Goal: only `BilingualCue`-shaped cues enter `ctx.lastCuesByTab` and the background-relayed broadcast
- Preconditions: handler registered; cues producer emits `{index,start,end,targetText,nativeText}` objects
- Basic flow:
  1. actor sends `SUBTITLE_CUES_LOADED` `{tabId?, cues}`
  2. system validates via tightened `SubtitleCuesLoadedPayloadSchema` (`cues: z.array(bilingualCueSchema)` — `{index:number, start:number, end:number, targetText:string, nativeText:string}`)
  3. system stores/relays `parsed.data.cues` — no cast
- Alt flow: none
- Exception: any cue malformed → `{success:false, error:'Invalid …'}`; nothing cached or relayed
- Rules: `bilingualCueSchema` lives in `entities/message/schema.ts` next to the payload schema that uses it (payload-schema convention); mirrors `entities/media/types.ts` `BilingualCue`
- Postcondition: `payload.cues as BilingualCue[]` cast removed; `ctx.lastCuesByTab` + the background broadcast carry validated cues only. **Bounded**: the side panel also receives the broadcast via its own raw `onMessage` listener (`sidepanel/App.tsx:77-92`) — a forged cs `sendMessage` of the same type fans out to the panel without passing background validation; panel-side trust is a recorded follow-up, not this REQ
- NFR refs: NFR-1, NFR-3

REQ-3: `RESOLVE_SUBTITLE_DOWNLOAD` result validation
- Actor: side panel / extension UI
- Goal: only `SubtitleSearchResult`-shaped objects reach `pickDownloadKey`/`buildDownloadRequest`
- Preconditions: handler registered; search producers emit interface-shaped results
- Basic flow:
  1. actor sends `RESOLVE_SUBTITLE_DOWNLOAD` `{result, role}`
  2. system validates via tightened `ResolveSubtitleDownloadPayloadSchema` (`result: subtitleSearchResultSchema`)
  3. system uses `parsed.data.result` directly — no cast
- Alt flow: none
- Exception: malformed result → `{success:false, error:'Invalid …'}`; no key pick, no fetch
- Rules: `subtitleSearchResultSchema` (+ `subtitleDownloadKindSchema` discriminated union `{kind:'direct',url:string}`/`{kind:'handshake',fileId:number}`) lives in `entities/message/schema.ts` — `entities/subtitle/searchTypes.ts` is header-declared "pure types only", so schemas stay with the payload schemas that consume them; `source` enum = `'subdl'|'opensubtitles'`; `format` enum = `'srt'|'vtt'|'ass'`; optional fields (`rating`, `downloads`, `sdh`, `forced`, `isArchive`) optional in schema
- Postcondition: `rawResult as unknown as SubtitleSearchResult` removed; `result.source as SubtitleApiKeyProvider` also removed (schema-typed `source` makes it redundant)
- NFR refs: NFR-1, NFR-3

REQ-4: `UPDATE_SETTINGS` patch sanitization
- Actor: extension UI or content script (`popupLifecycle`, `orbitalBadgeSync` send `{settings:{dictionaryPopup:…}}` partials; popup sends full/partial patches)
- Goal: only known, correctly-typed settings keys merge into persisted settings
- Preconditions: handler registered; `DEFAULT_SETTINGS` is the SSOT for defaulted keys
- Basic flow:
  1. actor sends `UPDATE_SETTINGS` `{settings: record}`
  2. system envelope-validates (`settings` field becomes `z.record(z.string(), z.unknown())`)
  3. system runs `sanitizeSettingsPatch(parsed.data.settings)` → `Partial<Settings>`
  4. system merges `{...current, ...patch}` → `saveSettings` → applies each of the four eager keys **if present in the sanitized patch** (`concurrentDownloads` → `setMaxConcurrent`, `convertToMp4` → `setConvertMode`, `segmentConcurrency` → `setSegmentConcurrency`, `filenameSource` → `setFilenameSource`) — a dropped mistyped key must not fire its setter
- Alt flow: empty/invalid patch → merge is a no-op; handler still returns current settings `{success:true, data: merged}` (patch sanitization is lossy-by-design — a dropped key is not an error)
- Exception: `settings` not a record → envelope fails → `{success:false}`; `saveSettings` rejection propagates through the existing handler try/catch unchanged
- Rules — `sanitizeSettingsPatch` (new `src/entities/settings/settingsPatch.ts`):
  - Per-key dispatch table `SETTINGS_PATCH_RULES: Partial<Record<keyof Settings, validator>>` is the single source — a listed key uses its own validator regardless of `DEFAULT_SETTINGS` membership; unlisted keys fall through to default matching. The table names the keys needing element-level or enum checks: `subtitleApiKeys` (array of objects with `id:string, provider:'subdl'|'opensubtitles', key:string, status:enum` — element check, not bare `Array.isArray`), `activeProfileId` (`null`-defaulted → accept `null | string` — **never** bare `typeof` equality, which would silently drop every legit string patch), `subtitlePreference`/`subtitleOffset`/`dictionaryPopup`/`pronunciation`/`frequencyBands`/`subtitleOverlayTargetStyle`/`subtitleOverlayNativeStyle` (record check), `subtitlePreviewTargetText`/`subtitlePreviewNativeText`/`defaultSubtitleLanguage` (string), `schemaVersion` (`number` — never patchable: always dropped)
  - Keys not in the rules table: must exist in `DEFAULT_SETTINGS` AND match the default's container kind — `Array.isArray` default → array check; non-null object default → record check; else `typeof` equality (plus `Number.isFinite` for numeric keys — `Infinity`/`NaN`/fractions on integer keys don't pass)
  - `SETTINGS_ENUM_FIELDS` — string-union keys additionally checked against their value lists: `uiLanguage`, `defaultQuality`, `convertToMp4`, `parallelConversion`, `parallelFallback`, `filenameSource`, `preferredVideoFormat`
  - returns `Partial<Settings>`; the single output cast inside the sanitizer is the validation boundary — handlers cast nothing
- Postcondition: malformed values, unknown keys, bad enum strings, and `schemaVersion` never reach `saveSettings` or the four eager setters. Bounded self-heal: `loadSettings`' existing `mergeNestedObjectDefaults`/`coerceDefaultTypes`/`validate*` path repairs *container-kind* mismatches on next load — same-type wrong values that slipped past pre-hardening storage remain until corrected (no regression introduced). **Known unchanged behavior**: `saveSettings` → `resolveSettingsFlatFields` rewrites flat profile-mirrored fields (`dictionaryPopup`, `subtitleOverlay*`, languages) from the active profile when `activeProfileId` resolves — senders patching those fields on a migrated profile were already overwritten before this item; out of scope to change. Nested-map keys (`subtitlePreference`, `subtitleOffset`) are replace-not-merge under the shallow merge — senders must send whole nested objects (existing convention, documented). Direct `chrome.storage.local` writes bypass message validation entirely — inherent to MV3 permissions, out of scope
- NFR refs: NFR-1, NFR-3, NFR-4

REQ-5: `LOOKUP_REQUEST` request validation
- Actor: content script
- Goal: only `LookupRequest`-shaped objects reach `lookupOrchestratorMulti`
- Preconditions: handler registered; lookup producers emit interface-shaped requests (`fallback` optional)
- Basic flow:
  1. actor sends `LOOKUP_REQUEST` `{request}` (runtime body `{request, tabId?}` — `tabId` injected bus-side)
  2. system validates via `lookupRequestSchema` (replaces `z.custom<LookupRequest>` at `src/entities/message/dictionarySchemas.ts:372` — `{term: string, langCode: string, contextSentence: string, cursorOffset: number, fallback?: boolean}`)
  3. system destructures `parsed.data` — no cast
- Alt flow: none
- Exception: malformed request → `{success:false, error:'Invalid …'}`; `plugin.tokenize` never called; orchestrator errors propagate through the existing handler try/catch unchanged
- Rules: schema lives in `src/entities/message/dictionarySchemas.ts`. The same file already has a stricter `LookupRequestSchema` (:27-33 — `term` max(200), `langCode` length(2), `contextSentence` max(2000)); a new `lookupRequestSchema` is added rather than reusing it because producers emit unbounded `contextSentence`/`term` — the existing caps would reject legit lookups (divergence recorded). New schema mirrors `src/entities/dictionary/types.ts:84` `LookupRequest` verbatim — plain `z.string()`/`z.number()`, no added `min(1)`/`int()` bounds (NFR-3 verbatim); optional `fallback` stays optional
- Postcondition: zero casts on the validated request
- NFR refs: NFR-1, NFR-3

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Malformed payloads fail closed at the validation boundary — no partial application of handler logic | security/reliability | `{success:false}` before any side effect in all five paths |
| NFR-2 | No new dependencies | infra | zod only (already used) |
| NFR-3 | Schemas mirror existing exported interfaces — no behavioral narrowing beyond declared types | maintainability | every legit current payload passes (round-trip tests) |
| NFR-4 | Settings allowlist derives from `DEFAULT_SETTINGS` where possible — new settings keys need deliberate inclusion | maintainability | adding a field without touching the allowlist = dropped patches (documented behavior) |

## Flows / States

```
DETECTED_SUBTITLES inbound
  envelope safeParse ──fail──> {success:false}
       │ pass
       ▼
  source branch (iqiyi|netflix|youtube|absent→youtube)
       │
       ▼
  trackArraySchema.safeParse ──fail──> {success:false}
       │ pass (typed)
       ▼
  map*SubtitleTracks → addDetectedSubtitles → broadcast/pushAutoLoad

UPDATE_SETTINGS inbound
  envelope safeParse ──fail──> {success:false}
       │ pass
       ▼
  sanitizeSettingsPatch (drop unknown/mistyped/bad-enum keys)
       │
       ▼
  merge → saveSettings → apply 4 eager keys from sanitized patch
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Reject malformed inbound payloads | per-source track schemas, `bilingualCueSchema`, `subtitleSearchResultSchema`, `lookupRequestSchema`, `sanitizeSettingsPatch` |
| Preserve sender compatibility | zod default-strip (extra keys ignored), optional-field optionality, absent-`source` YouTube defaulting, lossy settings merge |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| Track payloads | `baseUrl/languageCode/kind` (yt); `_name/lid/ss/srt` (iq); `trackId/bcp47/displayName/rawTrackType/isNoneTrack/isForcedNarrative/isImageBased/url` (nf) | wire only | n/a |
| `BilingualCue` | `index,start,end,targetText,nativeText` | `ctx.lastCuesByTab` per tab | tab lifetime |
| `SubtitleSearchResult` | `id,name,providerLanguage,isoLanguage,format,download{kind},source,+optional` | wire only | n/a |
| `Settings` patch | any subset of `Settings` keys | `chrome.storage.local` | persisted |
| `LookupRequest` | `term,langCode,contextSentence,cursorOffset,fallback?` | wire only | n/a |

## Traceability

| Need (intent) | REQ | AC |
|---|---|---|
| malformed `DETECTED_SUBTITLES` must not reach mappers | REQ-1 | AC-1 |
| malformed `SUBTITLE_CUES_LOADED` must not reach cache/relay | REQ-2 | AC-2 |
| malformed `RESOLVE_SUBTITLE_DOWNLOAD` must not reach download planner | REQ-3 | AC-3 |
| malformed `UPDATE_SETTINGS` must not persist | REQ-4 | AC-4 (deviation: intent said "validates a `Partial<Settings>` shape" — a strict schema can't express patch semantics since legit senders send *subsets* with unrelated keys; spec uses the `sanitizeSettingsPatch` allowlist — lossy-by-design drop, envelope stays a record) |
| malformed `LOOKUP_REQUEST` must not reach orchestrator | REQ-5 | AC-5 |
| no casts on validated data | REQ-1..5 | AC-6 |
| regression safety | NFR-3 | AC-7 |

| Journey step | REQ |
|---|---|
| AS-IS 2-3 (envelope passes garbage → cast → mapper) | REQ-1..5 |
| TO-BE 2-3 (real schemas → fail closed) | REQ-1..5 |
| TO-BE 4 (zero casts) | REQ-1..5 |

## Boundaries

- Always: schemas mirror interfaces verbatim; fail-closed error responses; per-branch validation where the envelope can't discriminate (`tracks` needs `source` to pick a schema); zod default-strip objects (never `.strict()` — producers emit raw objects with extra keys)
- Ask first: none
- Never: widen `params` (AnkiConnect opaque by design), validate `_OFFSCREEN_*`/postMessage-bridge payloads here (follow-up items), drop legit optional Settings keys from the rules table, `.strict()` any payload schema
- Rejected alternatives:
  - *Strict `Partial<Settings>` zod schema* — rejected: zod object schemas can't express "subset of a fixed interface with lossy unknown-key tolerance" without duplicating every field; a per-key sanitizer keeps `DEFAULT_SETTINGS` as SSOT
  - *Per-element track filtering* — rejected: silent partial drops hide producer bugs; all-or-nothing array rejection is the fail-closed contract
  - *Reusing existing `LookupRequestSchema`* — rejected: its caps (200/2/2000) reject legit unbounded producer payloads
  - *Discriminated-union envelope for `DETECTED_SUBTITLES`* — rejected: would require senders to always send `source`, breaking absent-source backward compat

## Success Criteria

1. `detectionDispatch.ts` uses `DetectedSubtitlesPayloadSchema.safeParse` (no envelope cast) and each source branch safeParses `tracks` via its track-array schema; malformed envelope or tracks → `{success:false}` before mapping; absent `source` still maps as YouTube; `tracks:[]` still hits the overlay-clear branch; track fixtures carrying producer extra keys pass (default-strip).
2. `SubtitleCuesLoadedPayloadSchema.cues` is `z.array(bilingualCueSchema)`; `subtitle.ts` uses `parsed.data.cues` with no cast.
3. `ResolveSubtitleDownloadPayloadSchema.result` is `subtitleSearchResultSchema`; `subtitleSearch.ts` uses `parsed.data.result` with no cast (including no `result.source as` cast).
4. `UPDATE_SETTINGS` merges only `sanitizeSettingsPatch` output — unknown keys, mistyped values, bad enum strings (`defaultQuality:'bogus'`), `Infinity`/fractional numbers, and `schemaVersion` never reach `saveSettings`; the four eager setters fire only when their key survived sanitization; `activeProfileId` accepts both `null` and string.
5. `LOOKUP_REQUEST` validates `lookupRequestSchema`; `lookup.ts` uses parsed data with no cast.
6. Zero `payload.X as T`/`request.payload as T` casts remain on registry-validated data in the five handlers (grep-verified).
7. Unit tests: well-formed real payloads pass all five paths (incl. tracks with extra producer keys, `activeProfileId` string patch); malformed variants rejected; track-schema fixtures match real producer shapes; sanitizer tests cover unknown-key drop, mistyped drop, enum rejection, `schemaVersion` drop, optional-key accept, non-finite number drop.
8. `npm run typecheck`, `lint`, `test:unit`, `build` all green.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] No TSX/CSS touched — design-system check n/a
- [ ] `docs/2-architechture-system.md` updated (new schema/sanitizer modules)
- [ ] No manifest/dependency changes

## Open Questions / Accepted Risks

- None blocking. Follow-ups recorded in intent: MGR-bridge postMessage shape validation; `_OFFSCREEN_*` sender scoping; side-panel raw `onMessage` trust for `SUBTITLE_CUES_LOADED` (REQ-2 bound); `useLibraryScores` stale token cache.
- Accepted risk: sanitizer is lossy — a future sender adding a new Settings key gets silently dropped patches until the rules table is updated (NFR-4: deliberate).
- Accepted risk: `LOOKUP_REQUEST`/cues/results senders are extension-internal — shape validation here is hygiene/SSOT, not a new trust boundary (shape ≠ trust).
