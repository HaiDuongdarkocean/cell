# Spec: Debug-seam hardening

> Intent: `docs/intent/debug-seam-hardening.md` · ui_surface: no · Mode: all

## Objective

Harden the residual seams where extension internals cross into page-observable surface: ungated debug writes onto shared DOM/globals, cross-frame `postMessage(..., '*')`, full-URL propagation in relayed signals, and unvalidated inbound `__Tihoka_SUBTITLE_DISCOVERY` handling that lets a hostile embedded frame poison the top frame's subtitle cache — while repairing the legitimate cross-origin relay (dead today on a missing `nonce`) and keeping `Tihoka_E2E=1` observability identical.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Host page scripts (same-window, own origin) | page lifecycle, own `postMessage` | message events, DOM mutations | same-origin globals — unchanged trust domain |
| Embedded player iframe (cross-origin frame + its MAIN-world IIFE) | player init, subtitle/track discovery | `__Tihoka_SUBTITLE_DISCOVERY`, `MGR_*`, `__Tihoka_PLAYER_MODE_*` posts | ENTERED/EXITED, MGR_ACTION, MGR_CLOSE replies |
| Embedder page scripts (top frame, cross-origin) | — | — | message events delivered to the top window — must not receive extension-internal traffic |
| Build pipeline | `vite build` / `build-e2e` | `Tihoka_E2E` env | bundles with `__Tihoka_DEBUG__` define |
| E2E suite | stage2 specs | `data-tihoka-*`/`__ocr*`/`__Tihoka_*` markers | identical marker set in `Tihoka_E2E=1` builds |

System-internal processing never includes human behavior. Actors trigger, input, receive; the content scripts/background do all processing.

## Requirements

### Functional

REQ-1: Debug-write gating
- Actor: Build pipeline (indirectly: every code path that writes debug markers)
- Goal: In production builds (`__Tihoka_DEBUG__` undefined or `'false'`), no extension-internal marker reaches page-observable DOM (`document.documentElement`/`document.body` dataset) or page-shared `window` globals. ISOLATED-world `globalThis` writes (`__ocrCtrlTimings`, `__ocrStepTimings`, `__ocrCaptureDbg`) are not page-observable — gating them is still required hygiene so every debug write routes through one gate (N5), not because they currently leak.
- Preconditions: `__Tihoka_DEBUG__` define exists per bundle (`vite.config.ts`).
- Basic flow:
  1. system encounters a debug-write site during execution
  2. system evaluates the debug gate
  3. production build → write skipped; `Tihoka_E2E=1` build → write executes exactly as today
- Alt flow: none — the gate is a single boolean.
- Exception: none — gate failure mode is "skip write" (safe direction).
- Rules:
  - Gate sites (all currently ungated): `src/entrypoints/content/ocrController.ts` `ocrInitStep`/`ocrBgResponse`/`ocrBgException`/`__ocrCtrlTimings`/`ocrRecognizeError`; `src/features/ocr/pipeline/ocrPipeline.ts:254` `__ocrStepTimings`; `src/features/ocr/pipeline/frameCapture.ts:31,33` `__ocrCaptureDbg`; `src/features/subtitle/ui/contentScriptMessages.ts:181-190` `__Tihoka_AUTOLOAD_HANDLED` post; MAIN-world `__YT_DEBUG`/`__IQ_DEBUG`/`__NF_DEBUG` publish writes (`youtube-main-world.iife.ts:128`, `iqiyi-main-world.iife.ts:49`, `netflix-main-world.iife.ts:56`).
  - `__*_DEBUG` gating covers the PUBLISH write only — internal debug counter objects the IIFEs mutate throughout (e.g. `netflix-main-world.iife.ts:228-357`) stay live; only the `window.__*_DEBUG` assignment is gated. These IIFEs currently lack `declare const __Tihoka_DEBUG__` — declares are added as part of REQ-2.
  - `regionSelector.ts:412-413` `data-ocr-region-selecting` is functional (hides panel during region select) — MUST remain ungated. Same for `data-tihoka-player-mode`/`data-tihoka-player-mode-host` (`iframePlayerModeBridge.ts:114,138,154`) and `dataset.tihokaPlayerMode` (`reactSubtitleController.ts:783,790`).
  - Already-gated sites stay as-is — verify, don't rework (`mediaScan.ts:44-56`, `subtitleBridges` debug attrs, `episodeWatcher`, `contentScriptLifecycle`, `webTokenizeController`, `debugLog`, and ~20 gated `dataset.ocr*`/`__ocr*` writes in `ocrContentScript.ts:186-449`).
- Postcondition: production bundle produces zero page-observable markers; `Tihoka_E2E=1` bundle produces the complete current marker set.
- NFR refs: NFR-1, NFR-3

REQ-2: Single shared debug-gate helper
- Actor: Build pipeline / maintainer (indirect)
- Goal: One canonical implementation decides debug-mode; every bundle routes through it.
- Preconditions: current state has 3 helper copies (`debugLog.ts:6`, `ocrContentScript.ts:30-34`, `src/features/subtitle/ui/contentScriptMessages.ts:21-25`), an `isDebug()` copy (`fetchInterceptor.iife.ts`), and inline `typeof __Tihoka_DEBUG__` checks (`ocrContentScript.ts:901`, `contentScriptLifecycle`, `webTokenizeController`, `logger`). The three site IIFEs (`youtube-main-world.iife.ts`, `iqiyi-main-world.iife.ts`, `netflix-main-world.iife.ts`) currently lack a `declare` entirely and gain one to gate the `__*_DEBUG` publish writes.
- Basic flow:
  1. system defines one dependency-free gate function (no imports — MAIN-world IIFE bundles cannot import `debugLog.ts`, which pulls `chrome-apis`)
  2. importable bundles import the helper from its single source
  3. bundles that cannot import shared code (IIFE entrypoints) declare `__Tihoka_DEBUG__` locally and implement the identical one-line check — no third logic variant
- Alt flow: —
- Exception: —
- Rules: the helper carries zero imports; `debugLog.ts` re-exports it rather than redefining; no new dependencies.
- Postcondition: exactly one gate implementation exists in the repo; per-bundle `declare` remains only where bundling constraints require it.
- NFR refs: NFR-3

REQ-3: Explicit-origin cross-frame sends
- Actor: Embedded player iframe / top frame (endpoints of each bridge)
- Goal: No cross-frame `postMessage` uses `'*'`; every send names a resolved http(s) target origin and fails closed when that origin cannot be established.
- Preconditions: current `'*'` sends: `subtitleDiscovery-main-world.iife.ts:101` (parent relay), `src/features/subtitle/ui/contentScriptMessages.ts:182-187` (`__Tihoka_AUTOLOAD_HANDLED` — ungated AND mis-targeted at `location.origin`, which can never match a cross-origin parent), `iframePlayerModeBridge.ts:180,195` (top→child notify), `:305,:331` (child→top enter/exit), `iframeManagerBridgeChild.ts:28,50,61,103` (child→top MGR posts), `iframeManagerBridgeHost.ts:40` (host→child via `postToIframe`), `mediaScan.ts:47` (`__Tihoka_DEBUG_PAGE_SCAN` — debug-gated but still `'*'` in E2E builds).
- Basic flow:
  1. system composes a cross-frame message
  2. system resolves the target origin — child→parent: `location.ancestorOrigins?.[0]` (browser-maintained, survives intra-iframe self-navigation where `document.referrer` becomes the iframe's own previous URL) with `new URL(document.referrer).origin` as fallback; top/host→child: the iframe element's `src`-derived origin, or `event.origin` when replying to a received message
  3. resolved origin valid http(s) → `postMessage(msg, origin)`; unresolvable → skip send
- Alt flow: `postToIframe` already resolves the iframe by origin — pass that same origin as targetOrigin.
- Exception: no resolvable parent origin (sandboxed/opaque iframe → `ancestorOrigins` empty, `referrer` empty or non-http(s)) → skip the parent send; same-window post unaffected. `iframe.src` empty/`about:blank`/`srcdoc` → `new URL` throws or yields non-http(s) → skip send (recorded in Open Questions — top-initiated PM/MGR notify dies on src-less iframes, a bounded regression vs `'*'` today).
- Rules:
  - Resolvable origin = a string parseable by `new URL()` with `http:`/`https:` protocol — anything else (`'null'`, `'about:blank'`, `''`) is unresolvable → fail closed.
  - `__Tihoka_AUTOLOAD_HANDLED` and `__Tihoka_DEBUG_PAGE_SCAN` additionally become debug-gated (REQ-1) — production sends nothing.
  - Same-window `window.postMessage(msg, '*')` posts stay `'*'` (targetOrigin is meaningless for self-delivery).
- Postcondition: zero `'*'` cross-frame sends; each channel delivers only to its intended peer origin.
- NFR refs: NFR-2

REQ-4: Origin-only relayed payloads
- Actor: MAIN-world IIFEs (signal producers)
- Goal: Signals crossing frame/world boundaries carry origins, not full URLs — `initiator` and bridge `frameSrc` must not leak query strings or tokens.
- Preconditions: `subtitleDiscovery-main-world.iife.ts:151-157` uses `location.href`; `fetchInterceptor.iife.ts:189,238` uses `location.href`; bridge posts use `frameSrc: location.href`.
- Basic flow:
  1. system builds a signal/bridge message
  2. `initiator` fields → `location.origin`; `frameSrc` fields → `location.origin + location.pathname` (query/hash stripped — `findIframeBySource`'s origin+pathname fallback still matches)
  3. system posts the minimized payload
- Alt flow: `mediaScan.ts:156,181` `initiator: location.href` stays — chrome.runtime-internal, never crosses a world boundary (explicit intent Out). Debug-gated sends are exempt from minimization: `__Tihoka_AUTOLOAD_HANDLED`'s `href` and `__Tihoka_DEBUG_PAGE_SCAN`'s `pageUrl` carry full URLs by design — E2E asserts on them — and production never sends (REQ-1/REQ-3).
- Exception: opaque origin — `location.origin` returns `'null'` (it does not throw) → the whole send is already skipped by REQ-3's fail-closed rule; field construction is moot. Real throws (rare) → `''` (current fallback preserved).
- Rules:
  - `network-response.url` is NOT minimized — the exact URL keys the subtitle cache (signed blob/query URLs); only `initiator`/`frameSrc` shrink.
  - `apiKeys` inside `SerializedManagerState` (`managerStateSerializer.ts:33`, `iframeManagerBridgeTypes.ts:38`) cross the bridge as today — real user credentials posted to the embedder window's scripts via `MGR_OPEN`/`MGR_STATE`/`apiKeysChange`. Recorded as residual exposure in Open Questions (redaction changes Manager Sheet UX — out of this item's scope).
- Postcondition: no `location.href` value leaves a frame boundary on production paths; path/query tokens never enter relayed discovery signals or bridge identifiers.
- NFR refs: NFR-2

REQ-5: Inbound discovery validation + repaired relay
- Actor: Any window able to `postMessage` to the top frame (trusted: our iframe IIFE; untrusted: embedded ads/hostile frames, same-window page scripts)
- Goal: Only schema-valid `__Tihoka_SUBTITLE_DISCOVERY` signals reach `cacheSubtitleBody` and the background relay; origins are taken from `event.origin`, not self-reported fields; the legitimate iframe relay delivers again.
- Preconditions: `subtitleBridges.ts:44-64` currently accepts any `event.source !== window` post, calls `cacheSubtitleBody` unvalidated (:49), then forwards `{origin: location.origin, signal}` with no `nonce` — `subtitleDiscoveryPayloadSchema` (`entities/subtitle/discoverySchemas.ts:85-89`) requires `nonce: z.string().min(16)` → background rejects → relay dead while the cache write still lands.
- Basic flow:
  1. actor posts `{type:'__Tihoka_SUBTITLE_DISCOVERY', signal}` to the top window
  2. system rejects `event.origin === 'null'` or non-http(s) origins → drop
  3. system validates `data.signal` against `subtitleSignalSchema` (`entities/subtitle/discoverySchemas.ts:77-83`) → drop on failure
  4. system overrides `signal.origin`/`signal.initiator` with `event.origin` (browser-enforced) and re-checks the result is a valid origin before use
  5. `network-response` + body → `cacheSubtitleBody(url, body)` (existing size/format checks still apply)
  6. system generates a `nonce` receiver-side (`crypto.randomUUID()` with the `${Date.now()}-${rand}` fallback for insecure contexts — pattern already at `subtitleBridges.ts:141-143`) and forwards `{nonce, origin: event.origin, signal}` via `SUBTITLE_DISCOVERY_SIGNAL` → satisfies `subtitleDiscoveryPayloadSchema` → background accepts
- Alt flow: same-window `__Tihoka_SUBTITLE_DISCOVERY` (handler at :136-153) gets the same signal validation; relay origin = `location.origin` (already correct). A forged same-window signal that passes schema still reaches `cacheSubtitleBody` AND the background pipeline (inventory/auto-load) — same trust domain, recorded honestly in Open Questions.
- Exception: schema-invalid signal → drop silently (or `console.warn` under debug gate); `event.origin === 'null'` (opaque/sandboxed frame) → drop — fail closed, consistent with `originSchema` rejecting `'null'` downstream anyway.
- Rules:
  - Validation happens BEFORE `cacheSubtitleBody` — no side effects on unvalidated input.
  - `event.origin` is the only trusted origin; `signal.origin`/`initiator` are hints only.
  - NO wire `nonce` is required on the bridge message: senders (`subtitleDiscovery-main-world.iife.ts:91,101`, `fetchInterceptor.iife.ts:201,252`) don't emit one today and a wire nonce is trivially spoofable anyway — it buys nothing. The receiver generates the forwarded nonce, uniformly for both paths. `subtitleDiscoveryBridgePayloadSchema` (which requires wire nonce) is therefore NOT the inbound validator — `subtitleSignalSchema` is.
- Postcondition: malformed/schema-invalid/foreign-origin signals are dropped before `cacheSubtitleBody` or the background relay; well-formed signals are re-origined via `event.origin` and accepted; legitimate iframe signals complete the full relay for the first time.
- NFR refs: NFR-2, NFR-4

REQ-6: Preserve functional and handshake seams
- Actor: E2E suite / maintainer (verifies the invariant)
- Goal: Behavior the page/UX depends on is untouched by REQ-1..5.
- Preconditions: hardening changes applied to the same files that carry functional seams.
- Basic flow:
  1. system gates/origin-scopes a write or send
  2. system verifies functional flags and handshakes still fire
  3. stage2 suite confirms no regression
- Alt flow: —
- Exception: a gate or origin check that removes a functional flag is a defect, not a hardening — revert that site.
- Rules:
  - Ungated-by-design: `data-ocr-region-selecting`, `data-tihoka-player-mode(-host)`, `dataset.tihokaPlayerMode`, `__*_CS_READY`/`__*_MAIN_WORLD_INJECTED`/`__Tihoka_CS_READY` announcements, same-window `__Tihoka_OCR_*` posts + their inbound listeners.
  - Gating or origin-scoping may only alter reachability to OTHER origins — never remove a functional flag or a same-window handshake.
- Postcondition: OCR region select hides the panel; MAIN-world handshakes re-fire on readiness; OCR toggle/state listeners respond to same-window posts as today.
- NFR refs: NFR-1

REQ-7: Inbound cross-frame listener checks (PM/MGR bridges)
- Actor: Any embedded frame able to `postMessage` to the top window (trusted: our player iframe; untrusted: ads/hostile embeds)
- Goal: Inbound `__Tihoka_PLAYER_MODE_*` and `MGR_*` messages are only honored from a window that is actually an iframe on the page (or, child-side, from the resolved parent origin) — a hostile frame cannot trigger fullscreen/sheet UI or spoof actions.
- Preconditions: `installIframePlayerModeBridge` (`iframePlayerModeBridge.ts:228-243`) accepts ENTER/EXIT from any window trusting self-reported `frameSrc` — a hostile embed can trigger the fullscreen/no-gesture fallback (`z-index:2147483647` overlay = phishing-grade UI takeover). `installManagerSheetBridge` validates `hasIframeWithOrigin(e.origin)` but not that `data.frameSrc` matches `e.origin` — a forged `MGR_OPEN` from any embedded iframe renders attacker-controlled state on the host sheet. Child-side listeners (`iframePlayerModeBridge.ts:296-303`, `subtitlePlayerMode.ts:29-38`, `iframeManagerBridgeChild.ts:19-26,72-90`) accept any post.
- Basic flow:
  1. actor posts `__Tihoka_PLAYER_MODE_ENTER`/`MGR_OPEN`/etc. to the target window
  2. system checks the source — top-side: `e.source` is a `contentWindow` of an iframe element in `document` AND `e.origin` resolves http(s); for `frameSrc`-bearing messages, `new URL(frameSrc).origin === e.origin` must also hold; child-side: `e.origin` equals the resolved parent origin (REQ-3 resolution)
  3. check passes → process; fails → drop
- Alt flow: same-origin iframe (origin equals own) — the checks still hold.
- Exception: parent origin unresolvable (opaque embedder) → child-side listeners drop — fail closed; recorded in Open Questions (PM/MGR break on opaque embeds — bounded, same class as REQ-3's empty-referrer risk).
- Rules:
  - `e.source` is the strongest signal — a real iframe's `contentWindow`; prefer it over self-reported fields.
  - `frameSrc` self-reports are corroborated against `e.origin`, never trusted alone.
- Postcondition: forged PM/MGR messages from arbitrary windows are dropped; legitimate player iframes pass because they ARE iframes on the page.
- NFR refs: NFR-2, NFR-4

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | No functional regression: `Tihoka_E2E=1` marker set identical; Player Mode, Manager Sheet, OCR region select, subtitle discovery all work | R | stage2 suite green; no e2e spec changes needed |
| NFR-2 | Confidentiality/integrity at frame boundaries: no `'*'` cross-frame sends; origins authoritative; payloads minimized (apiKeys residual exposure recorded in Open Questions) | +security | grep-clean; unit/integration tests cover hostile-frame cases |
| NFR-3 | No new dependencies; shared helper is dependency-free | infra | helper module imports nothing |
| NFR-4 | Fail closed: unresolvable origin → no send; invalid envelope → drop before side effects | +security | covered by unit tests |

## Flows / States

Cross-origin discovery relay (the load-bearing flow):

```
iframe MAIN-world IIFE
  → post {type, signal} to window.parent @ resolved-parent-origin        [REQ-3/4]
top-frame content script (subtitleBridges)
  → event.origin http(s)?  ──no──→ drop                                  [REQ-5]
  → subtitleSignalSchema valid? ──no──→ drop
  → yes → override origin/initiator with event.origin
      network-response+body → cacheSubtitleBody                          [REQ-5]
      → sendMessage SUBTITLE_DISCOVERY_SIGNAL {nonce(receiver-generated), origin, signal}
background handler
  → subtitleDiscoveryPayloadSchema (incl. nonce) → pipeline
```

Origin resolution per direction:

```
child→parent : location.ancestorOrigins?.[0]  | fallback new URL(document.referrer).origin | neither http(s) → skip send
top→child    : event.origin (reply) | new URL(iframe.src).origin (initiated) | non-http(s) → skip
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Restrict debug observability to debug builds | shared `isTihokaDebug` gate helper (REQ-2); per-site gated writes (REQ-1) |
| Confine cross-frame traffic to intended peers | explicit-origin send resolution child→parent / top→child (REQ-3) |
| Minimize identifying payload in relayed signals | origin-only `initiator`/`frameSrc` normalization (REQ-4) |
| Admit only trustworthy discovery signals | signal zod validation, `event.origin` override, receiver-generated nonce forward (REQ-5) |
| Reject forged PM/MGR commands | `e.source`/origin inbound checks on bridge listeners (REQ-7) |
| Keep functional seams intact | ungated-by-design rule list + stage2 regression suite (REQ-6) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `__Tihoka_SUBTITLE_DISCOVERY` envelope | `type`, `signal` (no wire nonce — receiver generates the forwarded nonce) | postMessage wire | transient |
| `SubtitleSignal` (validated) | `kind`, `url`/`frameUrl`/`origin`, `tabId:0`, `frameId:0`, `initiator` (origin only) | bridge → `SUBTITLE_DISCOVERY_SIGNAL` payload | transient |
| Cached subtitle body | `url` (exact, signed) → `body` | `subtitleResponseCache` in-memory LRU (50 entries, 500KB/body) | frame lifetime |
| Debug markers | `data-tihoka-*` attrs, `__ocr*`, `__Tihoka_*`, `__{YT,IQ,NF}_DEBUG` globals | shared DOM/`window` (debug builds only) | page lifetime |
| Bridge messages | `MGR_*`/`__Tihoka_PLAYER_MODE_*` + `frameSrc` (origin+path); `SerializedManagerState` incl. `apiKeys` credentials — flagged residual exposure (Open Questions) | postMessage wire | transient |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 gated debug writes | REQ-1, REQ-2 | AC-1, AC-2 |
| N2 explicit origins | REQ-3 | AC-3 |
| N3 payload minimization | REQ-4 | AC-4 |
| N4 validated inbound + repaired relay | REQ-5 | AC-5 |
| N5 single gate | REQ-2 | AC-2 |
| (intent Out) `data-ocr-region-selecting` functional | REQ-6 | AC-6 |
| (intent Risk) PM/MGR bridge inbound forgery — same threat model as N4 | REQ-7 | AC-8 |
| (intent) `Tihoka_E2E=1` observability preserved | REQ-1, REQ-6 | AC-7 |

| Journey step | REQ |
|---|---|
| AS-IS 1 (frames inject) / TO-BE 1 (unchanged setup) | REQ-6 |
| AS-IS 2 (parent relay `'*'` + href) / TO-BE 2 | REQ-3, REQ-4 |
| AS-IS 3 (ungated OCR/MAIN-world writes) / TO-BE 3 | REQ-1 |
| AS-IS 4 (`__Tihoka_AUTOLOAD_HANDLED` + bridge `'*'`) / TO-BE 4 | REQ-1, REQ-3 |
| AS-IS 5 (forged signal → cache; dead relay) / TO-BE 5 | REQ-5 |
| AS-IS 4 (bridge `'*'` posts — inbound forgery side) | REQ-7 |

## Boundaries

- Always: `npm run typecheck && npm run test:unit && npm run build` before commit; validation before side effects on untrusted input; `event.origin` authoritative; fail closed.
- Ask first: manifest changes; new dependencies; touching `regionSelector` functional flags.
- Never: gate functional flags; weaken `subtitleDiscoveryPayloadSchema`; log secrets/subtitle bodies in production paths; same-window handshake removal.

## Success Criteria

- [ ] AC-1: Production build writes zero `dataset.ocr*`, `data-tihoka-debug-*`/`data-tihoka-*` debug attrs, `__ocr*`, `__Tihoka_*`, `__{YT,IQ,NF}_DEBUG` markers to page-observable DOM/globals (grep sites gated + runtime check on a mock page) — excluding the functional attrs enumerated in REQ-1 Rules (`data-ocr-region-selecting`, `data-tihoka-player-mode*`, `dataset.tihokaPlayerMode`).
- [ ] AC-2: One canonical debug-gate implementation (dependency-free) exists; importable bundles use it; per-bundle `declare` remains only in IIFE entrypoints that cannot import shared code; no third logic copy.
- [ ] AC-3: Zero cross-frame `postMessage(..., '*')` remains in `subtitleDiscovery-main-world.iife.ts`, `src/features/subtitle/ui/contentScriptMessages.ts`, `iframePlayerModeBridge.ts`, `iframeManagerBridgeChild.ts`, `iframeManagerBridgeHost.ts`, `mediaScan.ts`; every send resolves an explicit http(s) origin (`ancestorOrigins[0]` → referrer fallback for child→parent; `event.origin`/iframe-src for top→child) and skips when unresolvable.
- [ ] AC-4: No `location.href` value leaves a frame boundary on production paths — `initiator`/`frameSrc` carry origin (+pathname where identification needs it); `url`/`frameUrl` fields unchanged. Debug-gated sends (`__Tihoka_AUTOLOAD_HANDLED`, `__Tihoka_DEBUG_PAGE_SCAN`) keep full-URL fields by design (E2E asserts on them).
- [ ] AC-5: Inbound `__Tihoka_SUBTITLE_DISCOVERY` (cross-origin AND same-window) is signal-validated via `subtitleSignalSchema` before any `cacheSubtitleBody` write; `event.origin` supplies the relay origin (`'null'`/non-http(s) → drop); forwarded payload carries a receiver-generated `nonce` satisfying `subtitleDiscoveryPayloadSchema`. Test: malformed signal → dropped before cache; well-formed signal from a "cross-origin" source → accepted with `event.origin` as origin.
- [ ] AC-6: `data-ocr-region-selecting` remains ungated; `__*_CS_READY` handshakes and same-window `__Tihoka_OCR_*` listeners behave as today.
- [ ] AC-7: `Tihoka_E2E=1` builds emit the complete current marker set; existing stage2 specs stay green without modification.
- [ ] AC-8: PM/MGR inbound checks — `__Tihoka_PLAYER_MODE_ENTER`/`MGR_OPEN` from a window that is not an iframe `contentWindow` on the page is dropped; `frameSrc` mismatching `event.origin` is dropped; child-side listeners drop posts not from the resolved parent origin. Unit tests cover forged senders.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Unit tests: gate helper, signal validation (malformed/`'null'`-origin dropped before cache), origin resolution (unresolvable → skip), PM/MGR inbound source checks
- [ ] Real-Chrome stage2 verification: subtitle discovery (incl. iframe relay), Player Mode, Manager Sheet, OCR region select
- [ ] `docs/2-architechture-system.md` updated if messaging/seam architecture section changes; ADR if origin-resolution pattern becomes convention

## Open Questions / Accepted Risks

- `document.referrer`/`ancestorOrigins` empty under sandboxed iframes / `Referrer-Policy: no-referrer` / opaque embeds → child→parent sends (discovery relay, PM ENTER/EXIT, all `MGR_*`) silently skip on those hosts — fail closed; the empty-referrer case was already recorded in intent. Recorded, not resolved.
- `iframe.src` empty/`about:blank`/`srcdoc`/re-navigated → top-initiated PM/MGR notify dies on src-less iframes — bounded regression vs `'*'` today; reply-path (`event.origin`) unaffected.
- `apiKeys` (OpenSubtitles credentials) inside `SerializedManagerState` cross the bridge to the embedder window's scripts via `MGR_OPEN`/`MGR_STATE`/`apiKeysChange` — explicit targetOrigin does not hide the payload from the destination's own page scripts. Redaction changes Manager Sheet UX (key editing in iframe contexts) → out of this item's scope; flagged for a follow-up item.
- Well-formed forged `__Tihoka_SUBTITLE_DISCOVERY` signals (schema-valid, real `event.origin`) are accepted — bounded to the posting frame's per-frame in-memory cache + pipeline inventory; this is inherent once `event.origin` is honest.
- Same-window forged `__Tihoka_SUBTITLE_DISCOVERY` signals can reach `cacheSubtitleBody` AND the background pipeline — same trust domain (page can only affect its own origin/tab), accepted per intent.
- Same-window `__Tihoka_OCR_*`/`__{YT,IQ,NF}_*` posts and inbound `__Tihoka_OCR_TOGGLE`/`REGION_COMMAND` listeners remain page-script-reachable — same trust domain; accepted risk per intent.
- `__*_MAIN_WORLD_INJECTED`/`__*_CS_READY` presence announcements remain — extension presence already detectable via mounted DOM.
- Debug-gated sends (`__Tihoka_AUTOLOAD_HANDLED`, `__Tihoka_DEBUG_PAGE_SCAN`) carry full `href`/`pageUrl` in E2E builds only — by design (tests assert on them); production sends nothing.
