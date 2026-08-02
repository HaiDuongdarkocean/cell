# Spec: Generic Subtitle List Discovery — E4 End-to-End

## Status

Draft for human review. No implementation is authorized until this spec, plan, and task list are approved.

## Objective

Build a generic, extensible subtitle-discovery pipeline for Cell that accepts one streaming page/player
observation and produces the complete subtitle inventory in the extension background and subtitle panel.
The pipeline must support all nine audited player families without adding site-specific branches to the
core `NetworkInterceptor`.

The user-facing success condition is:

```text
subtitle list exposed by player
= normalized candidates
= replayable subtitle sources
= background inventory
= subtitle manager panel
```

A player-side observation, DevTools request, or PowerShell response alone is not support.

### In scope

- Generic discovery signals for network bodies, iframe source attributes, HTML documents, player state,
  native tracks, and HLS playlists.
- Strategy/adapter registry with reusable protocol adapters and site profiles.
- Typed candidate normalization with direct, relative, metadata, unresolved, and rejected states.
- Referer/Origin/token/frame context preservation and replay through existing MV3 mechanisms.
- Background inventory delivery and panel visibility for all nine audited sites.
- Unit/contract tests, subagent verification, live Chrome verification, and architecture documentation.

### Out of scope

- Downloading or bypassing protected video streams.
- Circumventing authentication, paywalls, CAPTCHA, or anti-bot controls.
- Brute-forcing obfuscated subtitle filenames.
- Executing arbitrary third-party JavaScript as a parser.
- Adding a new UI design system or replacing the existing subtitle panel.
- Claiming support for an unverified player/server variant.

## Acceptance Criteria

### AC-1 — Generic architecture

- [ ] Core code contains no `if (host === ...)` branches for the nine sites.
- [ ] Every site is registered through a typed adapter/profile registry.
- [ ] Adding a new protocol profile does not modify `NetworkInterceptor` control flow.
- [ ] Adapter matching, parsing, normalization, identity, and replay policy have separate contracts.

### AC-2 — Input and boundary validation

- [ ] Every external response/body/state enters through `unknown` or raw text and is validated before
      internal use.
- [ ] Invalid JSON, malformed HTML-variable syntax, invalid URLs, unsupported protocols, oversized
      payloads, and malformed entries are rejected with a typed reason.
- [ ] No `any` is introduced.
- [ ] No token, cookie, authorization header, signed URL, or decoder key is logged or committed.
- [ ] `blob:`, `data:`, `javascript:`, and non-HTTP(S) values are never presented as downloadable
      subtitle URLs.

### AC-3 — Candidate model

- [ ] A candidate preserves label, language, explicit format, source/provider, stable identity,
      default/forced/SDH/ASR metadata, frame, initiator, and replay context.
- [ ] Direct URL, relative URL, metadata handle, unresolved, expired, and rejected states are distinct.
- [ ] Metadata-only entries are not silently dropped or converted into fabricated URLs.
- [ ] Signed query parameters remain intact in the fetch URL; identity deduplication uses a separate
      adapter-owned identity key.
- [ ] Direct ready candidates can be converted into existing `DetectedSubtitle` records without losing
      language, display name, format, initiator, or frame context.

### AC-4 — Discovery channels

- [ ] Network response bodies from page fetch/XHR can reach an isolated content script/background via
      a nonce- and origin-validated bridge.
- [ ] Parent pages can parse observed iframe `src` attributes without requiring child DOM access.
- [ ] MAIN-world adapters can read allow-listed player state in the owning frame and relay it safely.
- [ ] Native `<track>` and existing generic file URL detection remain functional.
- [ ] HLS master/media playlists can be inspected for subtitle media entries when required.
- [ ] A preflight browser test confirms the existing MV3 `MAIN` + `all_frames` + `<all_urls>` configuration
      works in each approved target browser; no manifest change is assumed or made by default.

### AC-5 — Nine site adapters

The following minimum baseline must be represented by fixtures and live acceptance tests:

| Site family | Baseline player-side catalog | Required E4 result |
|---|---:|---|
| cinesrc/shuttletv | 100 API entries plus any verified built-in/auto entries | all current catalog entries replayable and visible |
| kisskh | 6 direct SRT | 6/6 |
| lookmovie2 | 111 catalog entries: 87 direct VTT + 24 OpenSubtitles metadata arrays | 87/87 direct entries plus a verified resolver for 24/24 metadata entries; otherwise explicit E4 release blocker |
| lunastream | 33 iframe-hash entries | 33/33 |
| broodingmovies | 42 `default_subs` entries | 42/42 with required context |
| moviepire/videasy | 85 encrypted-response VTT entries | 85/85 |
| noxx | 43 deep player-state VTT entries | 43/43 |
| myasiantv/kisscloud | 4 `playerjsSubtitle` entries | 4/4 with Referer |
| onflix/playembed | current audit: 2 VTT from server SN; NC/PA/OP unaudited | complete live catalog after the pre-audit of all supported servers/HLS variants; otherwise explicit E4 release blocker |

A site cannot be marked E4-supported if the current player catalog is larger than the delivered
inventory. Volatile signed URLs may change, but the captured request/context and entry count must match
within the same test session.

### AC-6 — Replay and auth

- [ ] Every candidate requiring Referer/Origin has those values captured from the owning frame/request.
- [ ] Tokenized URLs are replayed as captured; no guessed token generation is accepted.
- [ ] DNR/offscreen/content-script replay is tested for the actual resource type and exact URL shape.
- [ ] A failed replay reports the exact HTTP/CORS/auth reason and does not become a false positive.
- [ ] At least one live replay test exists for each distinct auth family: no auth, signed URL, Referer,
      Referer+Origin, and session/tokenized listing.

### AC-7 — Background and panel delivery

- [ ] After discovery, `NetworkInterceptor.getSubtitles(tabId)` contains the expected ready count.
- [ ] The subtitle manager panel displays the same ready count and language/format metadata.
- [ ] Duplicate observations do not duplicate inventory entries.
- [ ] SPA navigation/player reload does not leak entries across media or tabs.
- [ ] Unresolved entries are visible in diagnostic/test output and cannot be downloaded as if ready.

### AC-8 — Performance and safety

- [ ] Parsing a captured list is O(n) in entry count; deduplication is O(1) average per entry.
- [ ] No sequential fetch of every subtitle file is required just to show the list.
- [ ] Replay validation uses bounded concurrency and abort/size limits.
- [ ] The list-to-inventory update completes within the project's normal sub-3-second response target
      after the source body/state is available, excluding external provider latency explicitly reported.

### AC-9 — Verification and documentation

- [ ] Every adapter has pure parser fixtures and negative cases.
- [ ] Every task has an independent `subagent_general` verification record.
- [ ] E2E browser tests use the real extension profile and verify background inventory, not only DOM or
      DevTools network output.
- [ ] `docs/player-support.md` records evidence, counts, replay constraints, and known ceilings.
- [ ] `docs/2-architechture-system.md` and `docs/0-wiki.md` are updated for every source/doc structure
      change.

## Proposed domain contracts

```ts
export type SubtitleSignal =
  | { readonly kind: 'network-response'; readonly url: string; readonly body: string; readonly tabId: number; readonly frameId: number; readonly initiator?: string }
  | { readonly kind: 'frame-source'; readonly frameUrl: string; readonly ownerUrl: string; readonly tabId: number; readonly frameId: number }
  | { readonly kind: 'player-state'; readonly origin: string; readonly payload: unknown; readonly tabId: number; readonly frameId: number }
  | { readonly kind: 'document-html'; readonly url: string; readonly html: string; readonly tabId: number; readonly frameId: number; readonly initiator?: string }
  | { readonly kind: 'hls-playlist'; readonly url: string; readonly body: string; readonly tabId: number; readonly frameId: number; readonly initiator?: string };

export interface SubtitleDiscoveryAdapter {
  readonly id: string;
  readonly priority: number;
  match(signal: SubtitleSignal): boolean;
  discover(signal: SubtitleSignal, context: SubtitleDiscoveryContext): Promise<readonly SubtitleCandidate[]>;
}
```

The exact final types may be refined during the contract task, but they must retain the above
information and discriminated states.

## Commands and verification

```text
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run lint
npm run test:e2e:headed
```

For every source change under `src/`, run at minimum:

```text
npm run build
npm run typecheck
npm run test:unit
```

For browser-facing changes, use `browser-testing-with-devtools` and `stealth-chrome-devtools` with
`cell-profile`; verify extension inventory and panel counts.

## Project structure

Proposed locations, subject to the plan task contract:

```text
docs/specs/subtitle-list-discovery-e2e.md  → this specification
tasks/plan-subtitle-list-discovery-e2e.md → implementation plan
tasks/todo-subtitle-list-discovery-e2e.md → ordered task checklist
src/features/detection/                  → signal, adapter, parser, candidate logic
src/entrypoints/background/               → orchestration, replay, inventory delivery
src/entrypoints/content/                  → isolated relay and frame observation
src/entrypoints/offscreen/                 → bounded text/body fetch
src/entities/media/                       → typed candidate/detected subtitle contracts
src/entities/message/                     → validated bridge payloads
tests/unit/                               → pure parser/normalizer/identity tests
tests/integration/                        → background/replay/registry tests
tests/e2e/                                → real extension/browser acceptance
```

## Code style

- TypeScript, named exports, function/pure logic where possible.
- `unknown` at third-party boundaries; Zod schemas before internal use.
- No explicit `any`, no default exports, no silent fallback for malformed entries.
- Reuse existing `DetectedSubtitle`, message bus, offscreen fetch, and DNR helpers where contracts fit.
- Keep site-specific behavior in adapters/profiles, not shared core branches.
- Do not add dependencies without checking bundle impact and approval.

## Boundaries

### Always

- Preserve user-supplied URL and captured auth context.
- Validate untrusted payloads and URLs.
- Keep ready/unresolved/rejected states explicit.
- Run unit tests, typecheck, build, and required browser verification.
- Have a `subagent_general` independently verify every completed task.

### Ask first

- Changing `manifest.json`, host permissions, `all_frames`, or MAIN-world injection.
- Adding `chrome.debugger`, new dependencies, or persistent token storage.
- Changing the public `DetectedSubtitle`/message contract.
- Resolving external metadata through a new third-party API.
- Marking a site E4 when its live catalog is volatile or incomplete.

### Never

- Commit secrets, cookies, signed URLs, or real decoder keys.
- Execute arbitrary third-party code as a parser.
- Bypass CAPTCHA, auth, paywalls, or anti-bot protections.
- Claim E4 from DevTools/PowerShell-only evidence.
- Drop unresolved entries silently.
- Overwrite unrelated `tasks/plan.md` or `tasks/todo.md`.

## Open questions / release blockers

1. What legitimate resolver can turn the 24 lookmovie OpenSubtitles metadata arrays into direct files?
2. What is the complete onflix subtitle catalog across all server tabs and HLS variants?
3. Does the existing MAIN-world/all-frames manifest configuration work in every target MV3 browser? Any manifest/permission change requires approval.
4. Can the existing DNR/offscreen path replay every required Referer/Origin/token family?
5. The agreed release rule is: unresolved entries may appear in diagnostic output, but a site is not
   E4-supported until every catalog entry is replayable/downloadable. No exception is assumed.

These questions are implementation gates, not assumptions to fill silently.
