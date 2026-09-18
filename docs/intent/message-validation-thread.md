# Intent — message-validation-thread

Backlog #13 · Source: internal-audit (`docs/audits/20260916_src-features-entrypoints-shared.md`, item #10 — note: its line cites drifted; the cast lines are now `detectionDispatch.ts:61,68,74` and the bus passes `parsed.data`, not the raw request) · ui_surface: no

## Business Case

- **Need**: Inbound `chrome.runtime` messages from content scripts must be shape-validated before handler logic touches them — today the bus validates only the envelope while loose `z.unknown()`/`z.record()`/`z.custom()` fields let malformed arrays/objects reach mappers, caches, relays, and persisted settings.
- **Change**: tighten the loose payload schemas so `parsed.data` carries real types and every `as` cast on validated data disappears.
- **Solution direction**: mirror the existing TS interfaces as zod schemas (per-source track arrays, `BilingualCue`, `SubtitleSearchResult`, settings partial, `LookupRequest`), safeParse per-source tracks in the dispatch branch.
- **Value**: **type-safety + crash-resistance hardening on the hostile-input boundary** — malformed shapes fail closed with `{success:false}` instead of reaching mapper/cache/relay code. Honest bound: a *well-shaped* hostile payload still passes shape validation (shape ≠ trust); this fix removes the malformed-input path and the unchecked `as` casts, not content-level forgery.
- **Stakeholder**: end users (overlay correctness, settings integrity), the team (one place to change a shape).
- **Context**: `MessageBus.on()` already wraps every handler with `MESSAGE_REGISTRY[type].schema.safeParse` and passes `parsed.data` (`src/entrypoints/background/messageBus.ts:37-49`) — envelope validation is universal; the gap is *inside* the envelopes. `handleMessage` also force-sets `payload.tabId = sender.tab.id` for content-script senders (:137-147) — a good existing mitigation this work keeps.

## Evidence audit — claims vs code

### In scope (defect class: validated envelope + loose field + raw cast / no parse)

| Site | Current state | Gap | Reachability |
|---|---|---|---|
| `detectionDispatch.ts:49` | `request.payload as DetectedSubtitlesPayload` — no safeParse in handler at all | `tracks: z.array(z.unknown())` passes anything; `payload.tracks as Iqiyi/Netflix/YouTubeTrack[]` (:61,68,74) unchecked into mappers | **page-JS forgeable** — `subtitleBridges.ts:113-193` relays raw `data.tracks` from `window.postMessage` (`__YT/__IQ/__NF_DETECTED_SUBTITLES`); dedup even bypassable via empty videoId/tvid/movieId |
| `subtitle.ts:165` | safeParse runs, then `payload.cues as BilingualCue[]` | `cues: z.array(z.unknown())` — malformed cues reach `ctx.lastCuesByTab` + panel relay | extension-internal (isolated world) — no `externally_connectable`; buggy/edge-case input path |
| `subtitleSearch.ts:174` | safeParse runs, then `rawResult as unknown as SubtitleSearchResult` | `result: z.record(z.unknown())` — wrong-shaped result drives `result.source` → `pickDownloadKey` + `buildDownloadRequest` | extension-internal |
| `settings.ts:39-53` via `UPDATE_SETTINGS` | `settings: z.custom<Partial<Settings>>` validates only "non-array object" (`schema.ts:47`) | merged wholesale `{...current, ...payload.settings}` → persisted `saveSettings` + `setMaxConcurrent`/`setConvertMode`/`setSegmentConcurrency`/`setFilenameSource`; `direction: 'any'` | **worst blast radius** — persistent settings corruption; cs senders exist (`popupLifecycle.ts:214`, `orbitalBadgeSync.ts:49`) |
| `lookup.ts:31-36` via `LOOKUP_REQUEST` | `request: z.custom<LookupRequest>` object-check only (`dictionarySchemas.ts:372`) | destructured `term/langCode/contextSentence/cursorOffset` → `plugin.tokenize(contextSentence)`; throws caught → `{success:false}`, read-only impact | cs→bg |

### Verified not-a-defect / accepted-risk

| Site | Why out |
|---|---|
| `cardCreator.ts` `params: z.record(z.unknown())` | intentionally opaque — verbatim pass-through into the AnkiConnect POST body (`ankiConnectClient.ts:67`); no field reads, no cast |
| `SrsAddNotePayloadSchema.fields` | already `z.record(z.string(), SrsFieldValueSchema)` ✓ |
| `playerStateSignalSchema.payload: z.unknown()` | defended downstream — `payload.every(isString)`/`isRecord` narrowing + per-field checks (`playerState.ts:135-152`, `htmlVariable.ts:138`) |
| `srs.ts:75` `parsed.data as SrsOpenStudyPagePayload` | cast on already-strict schema — harmless |
| Offscreen `ffmpegRunner`/`ocrRunner` payload casts | internal `bg→offscreen` `_OFFSCREEN_*` messages. **Caveat**: the `_OFFSCREEN_` prefix is a convention — offscreen `onMessage` is reachable by any extension context incl. content scripts (`_OFFSCREEN_FETCH` → `fetchWithTimeout(payload.url)` is an SSRF-shaped primitive). Accepted risk, recorded for follow-up |
| `contentScriptMessages.ts` field casts | per-field guards exist for `timeMs`/`rate`/`action`/`seekTime`; `:162` `AutoLoadSubtitlesPayload` unguarded but sender is bg (internal trust) |
| iframe manager bridge postMessage casts (`iframeManagerBridgeHost.ts:96,104`, `iframeManagerBridgeChild.ts:85-87`, `subtitleManagerHost.ts:75-95`) — `data.state as SerializedManagerState`, `action as ManagerAction`, `args.result`, `args.keys` | Same defect class on the postMessage channel — origin/source checks shipped in `debug-seam-hardening`; shape validation there is a **follow-up item**, not this S-sized scope |

## Stakeholders

- **End user**: malformed payloads must not corrupt overlay, cue cache, downloads, or persisted settings.
- **Team**: schema tightening is centralized; interface↔schema drift is the known maintenance cost (mitigated: schemas mirror exported interfaces next to them / in `entities/message/schema.ts`).
- **Sender surfaces**: MAIN-world IIFEs + isolated content scripts on hostile pages (forgeable via postMessage relay for `DETECTED_SUBTITLES`; extension-internal for the rest).

## Risks

- **Over-strict schema breaks legit senders** → mitigation: mirror producer interfaces exactly; unit tests round-trip real recorded payloads.
- **Interface↔schema drift on future changes** → same as existing `entities/message/schema.ts` convention; schemas sit next to the types they mirror.
- **`Settings` partial schema strictness** → `Partial<Settings>` mirrored field-by-field; unknown keys should be stripped (zod `.strict()`-equivalent) or rejected — decide in spec; either way malformed values stop at the boundary.
- **False-sense-of-security** → docs/ACs must not claim shape validation = trust; follow-up items: MGR-bridge shape validation, `_OFFSCREEN_` sender scoping.

## Journey

AS-IS — a malformed inbound message today:

1. Page JS posts a forged `DETECTED_SUBTITLES` (`window.postMessage`) → `subtitleBridges` relays raw `data.tracks` → `chrome.runtime.sendMessage`.
2. `MessageBus.on` wrapper runs `DetectedSubtitlesPayloadSchema.safeParse` — passes: `tracks` is `z.array(z.unknown())`, so any shape survives the envelope.
3. `detectionDispatch` casts `payload.tracks as IqiyiSubtitleTrack[]` → `mapIqiyiSubtitleTracks` iterates it — a throwing field aborts before side effects, but wrong-shaped non-throwing tracks produce wrong subtitles or silent skips.
4. The same gap hits `UPDATE_SETTINGS` (`z.custom` object-check → wholesale merge into persisted settings), `SUBTITLE_CUES_LOADED` (`cues as BilingualCue[]` → `lastCuesByTab` + panel relay), `RESOLVE_SUBTITLE_DOWNLOAD` (`result` → provider key + download plan), `LOOKUP_REQUEST` (`request` → `plugin.tokenize`).
5. End state: nothing fails closed at the boundary; malformed input travels into logic.

TO-BE — the same senders, validated end-to-end:

1. Sender posts the message → bus wrapper runs the (now stricter) schema → envelope fields validated.
2. Inside handlers, loose fields carry real schemas: `tracks` safeParsed per-source in the dispatch branch; `cues`/`result`/`settings`/`request` typed by their tightened schemas.
3. Malformed shapes → `{success:false, error:'Invalid …'}` before any mapper/cache/relay/settings code runs — mappers see only `z.infer` output.
4. End state: zero `payload.X as T` casts on validated data in the five handlers; hostile malformed input stops at the boundary.

## Stories

- As a user on a hostile page, a crafted `DETECTED_SUBTITLES` cannot push malformed track objects into detection — done when each source branch safeParses its track array before mapping.
- As a user, a malformed `UPDATE_SETTINGS` cannot persist wrong-typed keys — done when `settings` is a validated `Partial<Settings>` schema.
- As a user, malformed `SUBTITLE_CUES_LOADED`/`RESOLVE_SUBTITLE_DOWNLOAD`/`LOOKUP_REQUEST` payloads fail closed — done when the three schemas carry real shapes.

## Decision

**go** — real, bounded (S), crash-resistance/integrity hardening on a boundary where at least one message type is page-JS-forgeable; all infrastructure exists (zod, registry, safeParse pattern). Scope = the five runtime-message sites above; postMessage-bridge shape validation and offscreen sender-scoping recorded as follow-ups.

## Acceptance criteria

1. `detectionDispatch.ts`: envelope via `DetectedSubtitlesPayloadSchema` (no `as`); each source branch safeParses `tracks` against its track schema — malformed → `{success:false}` before mapping; absent/undefined `source` still defaults to the YouTube branch (backward compat — note: an *unknown* `source` string fails the enum at envelope level, by design).
2. `SubtitleCuesLoadedPayloadSchema.cues` validates `BilingualCue` shape; `subtitle.ts` uses `parsed.data.cues` with no cast.
3. `ResolveSubtitleDownloadPayloadSchema.result` validates `SubtitleSearchResult` (incl. `download` discriminated union); `subtitleSearch.ts` uses `parsed.data.result` with no cast.
4. `UpdateSettingsPayloadSchema.settings` validates a `Partial<Settings>` shape (every known key typed; unknown keys stripped or rejected — spec decides); `settings.ts` merges `parsed.data.settings` with no cast.
5. `LookupRequestPayloadSchema.request` (or equivalent) validates `LookupRequest` shape; `lookup.ts` uses parsed data with no cast.
6. Unit tests: well-formed real payloads pass round-trip; malformed track/cue/result/settings/lookup shapes rejected with `{success:false}`.
