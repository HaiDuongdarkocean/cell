# Implementation Plan: Generic Subtitle List Discovery — E4 End-to-End

> Spec: `docs/specs/subtitle-list-discovery-e2e.md`
> Scope: all nine audited site families
> Execution status: planning only; implementation requires human approval

## Overview

Build a protocol-oriented subtitle discovery kernel that turns page/network/player observations into
validated, replayable subtitle candidates and delivers them to Cell's existing background inventory.
The core uses a registry of adapters; each adapter owns only its match, acquisition, parser, resolver,
and replay policy. The nine site families are added incrementally and are not hardcoded into
`NetworkInterceptor`.

The release gate is E4: expected player catalog count equals replayable candidate count, background
inventory count, and subtitle panel count in a real `cell-profile` browser session.

## Architecture decisions

1. **Strategy Registry:** generic protocol adapters plus site profiles; no host branches in core.
2. **Event-driven incremental pipeline:** process new response/frame/player signals once; do not rescan
   the whole page or fetch every subtitle file just to populate the list.
3. **Typed candidate state:** direct, relative, metadata, unresolved, expired, rejected, and ready are
   distinct states. Metadata cannot silently become a fake URL.
4. **Auth context travels with the candidate:** preserve frame, initiator, Referer, Origin, credentials,
   captured signed URL, and expiry policy without logging secrets.
5. **Existing pipeline remains compatible:** keep URL/native-track detection and Stremio resolver;
   add a metadata-preserving ingestion method rather than overloading URL heuristics.
6. **No generic query stripping:** signed subtitle URLs keep their full fetch URL; adapter-owned identity
   keys handle deduplication.
7. **E4 is per site and per current catalog:** volatile tokens may change, but the same-session expected
   count and replay contract must pass.

## Dependency graph

```text
Candidate/schema contracts
        ↓
Signal capture + secure frame relay
        ↓
Adapter registry + resolver/replay kernel
        ↓
JSON/iframe/HTML/player/HLS/encrypted adapters
        ↓
Background inventory + panel delivery
        ↓
Nine-site E4 browser acceptance + docs
```

## Phase 0 — Contract and baseline

### Task 1: Freeze the contract and baseline evidence

Define candidate states, discovery signals, replay context, adapter interface, identity key, and E4
count semantics. Convert the current audit into sanitized test fixtures without signed URLs, cookies,
or decoder secrets.

**Dependencies:** none
**Files likely touched:**

- `src/entities/media/types.ts`
- `src/entities/message/types.ts`
- `src/entities/message/schema.ts`
- `tests/unit/features/detection/*`
- `docs/specs/subtitle-list-discovery-e2e.md`

**Acceptance criteria:**

- [ ] Types use discriminated unions and no explicit `any`.
- [ ] `SubtitleCandidate` preserves label, language, format, source, status, frame, initiator, and
      replay context.
- [ ] Metadata handles are representable without pretending to be URLs.
- [ ] Sanitized fixtures record baseline counts: cinesrc 100, kisskh 6, lookmovie 111 with 24 metadata,
      lunastream 33, brooding 42, videasy 85, noxx 43, myasiantv 4, and onflix as unresolved full-catalog
      baseline requiring discovery.
- [ ] Existing `DetectedSubtitle` consumers remain type-compatible or a migration path is documented.

**Main verification:** `npm run typecheck`; unit schema/fixture tests.

**Subagent verifier prompt:**

```text
You are an independent contract verifier. Do not edit files.
Read docs/specs/subtitle-list-discovery-e2e.md and the Task 1 diff.
Run npm run typecheck and the focused unit tests.
Check that every external state is typed, metadata entries cannot be mistaken for URLs, no `any` was
introduced, and existing DetectedSubtitle/message consumers remain compatible.
Return PASS or FAIL with exact command output, file/line evidence, and any missing state.
```

### Task 2: Add secure observation signal schemas

Define validated message payloads for network response bodies, iframe source observations, document HTML,
player-state observations, and HLS playlist bodies. Include nonce/origin/frame/tab context and payload
size limits.

**Dependencies:** Task 1
**Files likely touched:**

- `src/entities/message/types.ts`
- `src/entities/message/schema.ts`
- `src/shared/config/messages.ts`
- `tests/unit/entities/message/*`

**Acceptance criteria:**

- [ ] Every signal has a discriminator and required tab/frame/source context.
- [ ] Zod schemas reject wrong types, oversized bodies, invalid origins, and missing nonce where needed.
- [ ] Unknown extra fields do not bypass validation.
- [ ] No token/header value is emitted through normal logging.

**Main verification:** `npm run test:unit -- --runInBand` focused schemas; `npm run typecheck`.

**Subagent verifier prompt:**

```text
Review Task 2 as a security-focused verifier. Do not edit.
Run the focused schema tests and typecheck. Fuzz or manually inspect malformed JSON/message payloads,
wrong origin, missing nonce, oversized body, and invalid tab/frame values.
Confirm that valid signals retain frameId, initiator, and payload kind, while secrets are not logged.
Return PASS/FAIL with reproducible evidence.
```

## Checkpoint A — Contracts and MV3 preflight

Do not implement browser hooks until Tasks 1–2 pass and Task 3A confirms the existing MV3 injection
configuration in the approved browser matrix. Any manifest/permission defect is a human approval gate.

## Phase 1 — Signal capture and kernel

### Task 3A: MV3 MAIN-world/all-frames preflight

Verify the existing manifest configuration before writing new bridge code. Current manifest evidence shows
`fetchInterceptor.iife.ts` with `world: MAIN`, `all_frames: true`, `match_origin_as_fallback: true`, and
`<all_urls>` host/matches. This task verifies runtime behavior in the approved browser matrix and does
not change `manifest.json`.

**Dependencies:** Task 2
**Files likely touched:**

- `public/manifest.json` (read-only unless a separately approved defect is found)
- existing `src/entrypoints/content/fetchInterceptor.iife.ts` (read-only)
- `tests/e2e/*` or a temporary local fixture outside production source

**Acceptance criteria:**

- [ ] Chrome headed `cell-profile` injects the MAIN-world fetch interceptor at document start.
- [ ] A cross-origin child frame matching `<all_urls>` also receives the intended bridge where browser
      policy allows it.
- [ ] Existing YouTube/iQIYI/Netflix bridge behavior remains unchanged.
- [ ] Chrome/Edge/Brave target behavior is recorded as PASS or an explicit browser blocker.
- [ ] No manifest or permission change is made without human approval.

**Main verification:** `npm run build`, headed browser fixture, manifest inspection.

**Subagent verifier prompt:**

```text
Act as an independent MV3/browser-permission verifier. Do not edit manifest or source.
Read public/manifest.json and existing MAIN-world entries. Run npm run build and a headed cell-profile
fixture with one top document and one cross-origin child frame. Verify document_start injection, valid
fetch observation, frame identity, and no regression in existing bridges. If Edge/Brave cannot be run,
record that as an explicit unverified browser, not PASS. Return PASS/FAIL with browser/version and
console evidence.
```

### Task 3: Implement frame-safe MAIN-world observation bridge

Add the smallest bridge needed to observe page fetch/XHR bodies and allow-listed player state. Relay from
MAIN world to isolated content script with nonce and origin checks, then to background. Keep existing
YouTube/iQIYI/Netflix bridges compatible.

**Dependencies:** Task 2 and Task 3A
**Files likely touched:**

- `src/entrypoints/content/*main-world*.ts`
- `src/entrypoints/content/*`
- `src/entrypoints/background/handlers/*`
- `src/entrypoints/background/index.ts`
- `tests/integration/content/*`

**Acceptance criteria:**

- [ ] A page fetch/XHR response body can be observed only for allow-listed signals.
- [ ] MAIN → isolated → background relay rejects wrong origin, wrong nonce, and unrelated messages.
- [ ] Frame ID and initiator are preserved.
- [ ] Existing main-world adapters and normal page behavior do not regress.
- [ ] No arbitrary page script is executed from a response body.

**Main verification:** `npm run test:integration`; `npm run typecheck`; browser smoke on a local fixture.

**Subagent verifier prompt:**

```text
Act as a fresh security/browser verifier for Task 3. Do not edit.
Inspect the diff and run integration tests/typecheck. Use a browser fixture that performs fetch and
XHR, sends a valid observation, sends a wrong-origin message, wrong nonce, oversized payload, and a
player-state-like object. Confirm only the valid observation reaches background and existing bridges
still work. Return PASS/FAIL and include console/network evidence.
```

### Task 4: Build adapter registry, acquisition context, and bounded pipeline

Create the registry and orchestration flow: match signal, acquire/parse, validate, normalize, resolve,
deduplicate, and commit ready candidates. Preserve existing `handleRequest` behavior and add a distinct
metadata-preserving ingestion path.

**Dependencies:** Tasks 1–3 and 3A
**Files likely touched:**

- `src/features/detection/*`
- `src/entrypoints/background/networkInterceptor.ts`
- `src/entrypoints/background/helpers.ts`
- `src/entrypoints/background/offscreenFetch.ts`
- `tests/unit/features/detection/*`

**Acceptance criteria:**

- [ ] Registry dispatch has no site-specific branches in `NetworkInterceptor`.
- [ ] Parser work is O(n) and candidate deduplication is O(1) average using an identity map.
- [ ] Direct candidate metadata is preserved when entering the existing inventory.
- [ ] Duplicate signals and player reloads are idempotent per tab/media/adapter identity.
- [ ] Replay uses captured initiator/frame context and bounded timeout/concurrency.
- [ ] Existing native-track, generic file, and Stremio flows pass unchanged.

**Main verification:** focused unit/integration tests, `npm run typecheck`, `npm run build`.

**Subagent verifier prompt:**

```text
You are an independent architecture verifier for Task 4. Do not edit.
Read the registry, pipeline, identity, replay, and ingestion diff. Run focused tests, typecheck, and
build. Search for host-specific branches in core NetworkInterceptor. Test duplicate signals, two
variants with different signed URLs, metadata/unresolved entries, and a direct candidate with explicit
language/format/initiator. Return PASS/FAIL with complexity and regression evidence.
```

## Checkpoint B — Kernel

Before adapters, verify one synthetic fixture end-to-end:

```text
synthetic JSON list → candidate registry → direct normalization → dedup → background inventory
```

The browser fixture must show inventory count equal to fixture count. If this fails, stop and repair the
kernel before adding site code.

## Phase 2 — Protocol adapter slices

Each task below must ship parser fixtures first, then integration wiring, then its own subagent verifier.
Tasks 5–9 can develop in parallel after Task 4, but registry integration and shared files must be merged
sequentially. Task 10A is a required research gate before Task 10; Task 10 cannot start with an
undefined expected catalog.

### Task 5: JSON array adapters — cinesrc and kisskh

**Dependencies:** Task 4
**Expected catalogs:** cinesrc 100; kisskh 6.
**Acceptance criteria:**

- [ ] cinesrc parses `url/display/language/format` and preserves SSA versus SRT.
- [ ] kisskh parses `src/label/land/default` and retains exact `kkey` URL.
- [ ] Both arrays reject malformed/missing URL entries.
- [ ] Replay tests cover cinesrc subtitle CDN and kisskh `kkey` listing context.

**Verification:** parser fixtures + replay integration + `npm run typecheck` + `npm run build`.

**Subagent verifier prompt:**

```text
Verify Task 5 without editing. Run the focused cinesrc/kisskh fixtures and integration tests.
Confirm counts 100 and 6, formats/languages are preserved, malformed entries are rejected, signed
query strings remain unchanged, and replay context is passed. Check background inventory in the
browser fixture. Return PASS/FAIL with counts and evidence.
```

### Task 6: JSON object adapters — lookmovie and broodingmovies

**Dependencies:** Task 4
**Expected catalogs:** lookmovie 111 (87 direct + 24 metadata); brooding 42.
**Acceptance criteria:**

- [ ] lookmovie direct string files resolve against the response origin.
- [ ] lookmovie array files become typed metadata handles and are not silently delivered as URLs.
- [ ] The metadata resolver is either verified or the site remains a visible release blocker.
- [ ] brooding parses `default_subs` and preserves code/lang/url.
- [ ] Referer/Origin replay is tested in the extension context, not only PowerShell.

**Verification:** fixtures, unresolved-count assertion, replay integration, typecheck/build.

**Subagent verifier prompt:**

```text
Review Task 6 independently. Do not edit. Run tests and inspect normalized output.
Assert lookmovie=87 ready + 24 unresolved until a resolver is proven; assert brooding=42 candidates.
Test exact replay headers through the extension path and report whether PowerShell-only evidence was
mistaken for extension evidence. Return PASS/FAIL with exact counts and blocker details.
```

### Task 7: iframe-hash and HTML-variable adapters — lunastream and MyAsianTV

**Dependencies:** Task 4
**Expected catalogs:** lunastream 33; MyAsianTV 4.
**Acceptance criteria:**

- [ ] lunastream reads only observed parent-owned iframe `src`, decodes `subs=[JSON]` once, and
      validates all 33 direct URLs.
- [ ] MyAsianTV parses only allow-listed `playerjsSubtitle` syntax from the player HTML.
- [ ] Relative/absolute URLs and labels are normalized to WebVTT candidates.
- [ ] MyAsianTV replay uses the captured kisscloud Referer and passes a real browser test.

**Verification:** fixtures, malformed-hash/HTML tests, live replay, typecheck/build.

**Subagent verifier prompt:**

```text
Verify Task 7 without editing. Run parser/security tests and browser replay tests.
Confirm lunastream=33 and MyAsianTV=4, reject malformed JSON/HTML variable values, never execute page
script, and confirm MyAsianTV fails without Referer but succeeds through the intended extension path.
Return PASS/FAIL with evidence and counts.
```

### Task 8: MAIN-world player-state adapter — noxx

**Dependencies:** Tasks 3–4
**Expected catalog:** noxx 43.
**Acceptance criteria:**

- [ ] Adapter reads only `window.the_subtitles` in the owning `cloudorchestranova.com/prorcp` frame.
- [ ] All 43 `[label]/relative-path` entries resolve to VTT URLs with frame origin.
- [ ] Token/referrer/frame context is retained and no cross-origin child DOM access is attempted.
- [ ] Deep-frame relay delivers 43/43 to background/panel in `cell-profile`.

**Verification:** MAIN-world fixture, frame relay integration, real noxx browser test, typecheck/build.

**Subagent verifier prompt:**

```text
Act as an independent frame/security verifier for Task 8. Do not edit.
Run bridge tests with a valid the_subtitles array, wrong-origin message, missing nonce, and malformed
entry. Then run the headed cell-profile noxx test and compare expected 43 with background and panel
counts. Return PASS/FAIL; any lower count is a blocker.
```

### Task 9: Encrypted response adapter — moviepire/videasy

**Dependencies:** Tasks 3–4
**Expected catalog:** videasy 85 current direct VTT entries.
**Acceptance criteria:**

- [ ] Current custom XOR/PRNG decoder is isolated behind an adapter, not spread through core.
- [ ] Seed acquisition, encrypted response capture, decoder validation, and JSON schema validation
      are independently testable.
- [ ] Decoder rejects wrong seed/tampered ciphertext and never logs secrets.
- [ ] Live `cell-profile` test produces 85 replayable entries and background/panel count 85.
- [ ] Adapter exposes a version/known ceiling so player decoder changes fail visibly.

**Verification:** deterministic decoder vector tests, tamper tests, live browser replay, typecheck/build.

**Subagent verifier prompt:**

```text
Review Task 9 adversarially without editing. Run decoder vectors, wrong-seed/tamper tests, typecheck,
and build. Inspect for secrets/logging and coupling to core. Run the headed videasy test and verify
85 decrypted candidates, 85 replayable URLs, and 85 background/panel entries. Return PASS/FAIL with
cipher/seed evidence but do not print secrets.
```

### Task 10A: Onflix server/HLS catalog pre-audit

Complete the missing player-side audit before implementing the Onflix adapter. Enumerate the parent
server tabs (`SN`, `NC`, `PA`, `OP`), capture each iframe/m3u8, inspect master/media playlists for
`EXT-X-MEDIA:TYPE=SUBTITLES`, and record every observed subtitle URL/content and replay context. This is
a research/fixture task; it must not mark Onflix E4 by inference from the two previously observed VTTs.

**Dependencies:** Task 4
**Files likely touched:**

- `docs/player-support.md`
- sanitized Onflix fixtures under `tests/data-test/` or adapter test fixtures
- no production source unless a separate parser gap is found and approved

**Acceptance criteria:**

- [ ] All supported server tabs are enumerated from the supplied page, with no guessed server.
- [ ] Each server's player/m3u8/VTT evidence is captured and labeled.
- [ ] Master/media HLS subtitle tags are explicitly recorded as present/absent.
- [ ] A concrete expected catalog count and direct/metadata split is written per server.
- [ ] Missing/blocked server evidence is an explicit release blocker, not treated as zero subtitles.

**Main verification:** headed `cell-profile` browser audit, sanitized fixture review, `git diff --check`.

**Subagent verifier prompt:**

```text
Act as an independent Onflix research verifier. Do not edit.
Use headed cell-profile on the exact supplied Onflix URL. Enumerate every server tab visible in the
page, capture each player iframe and HLS master/media playlist, inspect EXT-X-MEDIA subtitle tags,
and validate direct VTT content with the proper context. Return a server/count matrix with PASS/FAIL
per server. Do not accept the previous SN-only two-file observation as a complete catalog.
```

### Task 10: HLS and server-variant adapter — onflix

**Dependencies:** Tasks 3–4 and Task 10A
**Expected catalog:** the concrete per-server matrix produced by Task 10A; the current 2 VTT observation
is not a baseline.
**Acceptance criteria:**

- [ ] Master/media playlist parser handles `EXT-X-MEDIA:TYPE=SUBTITLES` and relative URLs.
- [ ] Direct VTT fallback is retained when HLS metadata is absent.
- [ ] All supported Onflix server tabs are enumerated and each server's subtitle catalog is captured.
- [ ] The final expected count is recorded and matched in background/panel.
- [ ] Token/Referer replay is tested per server, not inferred from SN.

**Verification:** HLS fixtures, server matrix, live browser tests, typecheck/build.

**Subagent verifier prompt:**

```text
Verify Task 10 independently. Run HLS parser fixtures for master playlists with and without subtitle
media, relative URLs, quoted attributes, and malformed tags. Use headed cell-profile Onflix to enumerate
every supported server and compare discovered VTT/HLS entries with background/panel counts. Do not pass
based on the two previously observed files alone. Return PASS/FAIL and the server/count matrix.
```

## Phase 3 — Delivery, regression, and documentation

### Task 11: Inventory/panel integration and E4 regression matrix

**Dependencies:** Tasks 5–10 and 10A
**Acceptance criteria:**

- [ ] Background and panel show the same ready count per tab/media.
- [ ] Unresolved entries remain explicit and are not downloadable.
- [ ] SPA navigation, iframe reload, duplicate requests, and signed URL changes do not leak or duplicate.
- [ ] All nine site rows have E4 evidence or a named release blocker.
- [ ] Existing Stremio/native-track/generic URL tests remain green.

**Verification:** `npm run test:unit`, `npm run test:integration`, `npm run build`, `npm run test:e2e:headed`,
plus a fresh `subagent_general` browser verifier using the nine-site matrix.

**Subagent verifier prompt:**

```text
Perform the final independent E4 audit without editing. Run unit/integration/build/e2e checks, then
use cell-profile to test all nine site adapters. For each site record expected, normalized-ready,
replayable, background, and panel counts. Verify duplicate/reload isolation and unresolved handling.
Return a PASS/FAIL matrix; any mismatch, missing server, or PowerShell-only replay is FAIL.
```

### Task 12: Architecture/docs closeout

**Dependencies:** Task 11
**Acceptance criteria:**

- [ ] `docs/player-support.md` contains current evidence/counts and no stale claim is presented as current.
- [ ] `docs/2-architechture-system.md` lists new source files, dependencies, and function index.
- [ ] `docs/0-wiki.md` indexes changed/new docs.
- [ ] Spec, plan, task statuses, and E4 evidence paths are linked.

**Verification:** Markdown/link review, `git diff --check`, architecture-tree inspection, and a
subagent documentation verifier that compares implementation to spec/AC.

**Subagent verifier prompt:**

```text
Review documentation closeout without editing. Compare spec AC, plan, source tree, tests, and live
E4 evidence. Search for stale counts, unsupported “supported” claims, missing changed files, broken
links, and missing blockers. Run git diff --check. Return PASS/FAIL with exact line references.
```

## Checkpoints

### Checkpoint A — Contracts and MV3 preflight

Tasks 1–2 pass type/schema tests; Task 3A verifies the existing MAIN-world/all-frames manifest behavior
in the approved browser matrix. All have independent subagent PASS evidence.

### Checkpoint B — Kernel

Tasks 3–4 pass the synthetic body/state-to-inventory fixture and subagent verification.

### Checkpoint C — Direct adapters

Tasks 5–8 pass their expected counts and replay contracts before encrypted/HLS work is released.

### Checkpoint D — Full E4

Task 10A produces the Onflix server/count matrix; Tasks 9–11 then produce a nine-site matrix with no unexplained count mismatch.

### Checkpoint E — Closeout

Task 12 passes documentation review. Only then can the feature be called E4-supported.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Player changes encrypted decoder | High | isolate decoder, vector tests, visible adapter version/ceiling |
| Signed URL/token expiry | High | retain captured URL/context; test same-session replay; report expiry |
| Cross-origin frame injection differs by browser | High | browser matrix, minimal permissions, frame-specific bridge tests |
| Response-body capture races page fetch | High | document-start hook, bounded buffer, fallback player-state adapter |
| Lookmovie metadata lacks resolver | High | keep 24 unresolved; block E4 rather than fabricate URLs |
| Onflix servers differ | High | enumerate all servers and require server matrix |
| 100+ entries slow UI | Medium | O(n) parse, Map dedup, virtualized/limited rendering only if needed |
| Existing inventory regression | High | preserve old paths and run regression checkpoint after each integration |

## Parallelization

Safe after Task 4:

- parser fixtures for Tasks 5–9;
- independent subagent verifier preparation;
- sanitized evidence fixtures;
- Onflix parser fixture preparation only; live server audit Task 10A remains a gate before Task 10.

Must remain sequential:

- candidate/entity contract before adapters;
- bridge before player-state adapters;
- registry before adapter registration;
- each adapter integration before shared-file next adapter;
- all adapters before final E4 matrix.

## Approval gate

Do not implement Task 1 until the human approves:

1. E4 definition and all-nine-site scope;
2. candidate unresolved semantics;
3. current-manifest preflight policy and permission/MAIN-world/DNR direction;
4. task order, including Task 3A and Task 10A, plus subagent verifier protocol;
5. release-blocker policy for lookmovie metadata and any incomplete Onflix server catalog.
