# Intent: Debug-seam hardening — extension debug surface must not leak into the host page

> Slug: `debug-seam-hardening` · Mode: all · Source: backlog row #11 (internal-audit → `docs/audits/20260916_src-features-entrypoints-shared.md` item 3)
> ui_surface: no
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Extension-generated internals (OCR results, background responses, timings, subtitle URLs) must not be readable by host-page scripts — the page is an untrusted principal, and several debug/relay channels currently write or post where any `MutationObserver`/`message` listener can read them | `ocrController.ts:30-59,91,100`, `ocrContentScript.ts:412`, `ocrPipeline.ts:254`, `contentScriptMessages.ts:182`, `subtitleDiscovery-main-world.iife.ts:101,149-157` | high |
| Change | Production builds currently emit ~10 ungated `dataset.ocr*`/`__ocr*` writes + an ungated cross-origin `__CELL_AUTOLOAD_HANDLED` post + `'*'`-targeted parent relay carrying full `location.href` → future: zero ungated writes, parent relay fails closed on explicit origin, inbound discovery signals are schema-validated with browser-enforced `event.origin` | same sites + `subtitleBridges.ts:44-64` | high |
| Solution | Gate every residual debug write behind the single `isCellDebug()` SSOT; scope cross-frame posts to explicit origins and minimize payload (origin, not href); validate + re-origin inbound signals at the bridge | direction only | high |
| Value | Users' viewing content (OCR'd text, subtitle bodies, page URLs) stays inside the extension trust boundary; hostile/embedded third-party scripts cannot surveil activity or inject spoofed subtitle signals; store-review surface shrinks | need inference from leak classes | high |
| Stakeholder | End users on embedded player sites (vidnest, playembed, moviepire-style hosts) where arbitrary third-party scripts share the page | backlog `Pain` + iframe-relay design comments `subtitleBridges.ts:38-43` | high |
| Context | MAIN↔ISOLATED worlds can only talk via `window.postMessage` — the channel itself is inherent; what travels on it and what lands in shared DOM/globals is the controllable seam | `subtitleBridges.ts:30-35`, MV3 isolated-world model | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers | Keep E2E/debug observability — `CELL_E2E=1` builds must still emit every marker tests rely on | `scripts/build-e2e.mjs:25` already sets `CELL_E2E=1`; gating preserves this |
| Customer | Users watching subtitled video on embed-aggregator sites | Their viewing data must not be readable by the host page's third-party scripts | none — they cannot act; protection must be default |
| Supplier/Dependency | Host pages, embedded player iframes, `document.referrer` | Parent relay must keep working so iframe subtitle discovery still functions | `document.referrer` is the only discoverable parent origin |
| Organization | Future contributors | One obvious gate (`isCellDebug`) so new debug writes don't silently leak | two duplicated `cellDebug()` copies exist today — `ocrContentScript.ts:32`, `contentScriptMessages.ts:23` vs canonical `debugLog.ts:6` |
| Regulator | Chrome Web Store review / privacy policy | Extension must not broadcast user activity data to pages | store policy alignment — reduces disclosure surface |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | No extension-internal debug data reaches shared DOM/globals in production builds — every `dataset.ocr*`, `data-cell-debug-*`, `__ocr*`, `__CELL_*` write is behind `isCellDebug()` | +security +privacy | ungated: `ocrController.ts:30-59` (`ocrInitStep`×4, `ocrBgResponse`, `ocrBgException`), `ocrController.ts:91` (`__ocrCtrlTimings`), `ocrController.ts:100` (`ocrRecognizeError`), `ocrPipeline.ts:254` (`__ocrStepTimings`), `frameCapture.ts:31,33` (`__ocrCaptureDbg` every frame), MAIN-world `__YT_DEBUG`/`__IQ_DEBUG`/`__NF_DEBUG` carrying `lastVideoId`/`lastMovieId` (`youtube-main-world.iife.ts:128`, `iqiyi-main-world.iife.ts:49`, `netflix-main-world.iife.ts:56`) | high |
| N2 | Cross-frame posts fail closed — `window.parent.postMessage`/`contentWindow.postMessage` targets an explicit origin, never `'*'` | +security | `subtitleDiscovery-main-world.iife.ts:101` (`'*'`), `contentScriptMessages.ts:182-187` (ungated + targetOrigin `location.origin` — can never match a cross-origin parent, dead-but-present), Player Mode / Manager Sheet bridges `iframePlayerModeBridge.ts:180,195,305-308,331-334`, `iframeManagerBridgeChild.ts:28-31,50-53,61-64,103-106`, `iframeManagerBridgeHost.ts:40` | high |
| N3 | Relayed signals carry minimum identifying payload — `initiator`/`frameSrc` is origin, not full `location.href` (query strings can carry session tokens) | +privacy | `subtitleDiscovery-main-world.iife.ts:149-157`, `fetchInterceptor.iife.ts:189,238` (`initiator: location.href` — these DO reach the pipeline via the nonce'd same-window relay `subtitleBridges.ts:136-151`), `frameSrc: location.href` in the bridge posts above | high |
| N4 | Inbound `__CELL_SUBTITLE_DISCOVERY` from non-self sources is schema-validated and re-origined from browser-enforced `event.origin`, not self-reported `signal.origin`; the legit iframe relay is also broken today (missing required `nonce`) and must be repaired in the same pass | +security (integrity) | `subtitleBridges.ts:44-64` accepts any `event.source !== window` post, trusts `signal.origin`; `cacheSubtitleBody` (`subtitleResponseCache.ts:17-19`) checks only size/format — no schema/origin check; relay dead: `subtitleBridges.ts:58-61` sends no `nonce` but `subtitleDiscoveryPayloadSchema` (`entities/subtitle/discoverySchemas.ts:85-89`) requires `z.string().min(16)` → background rejects | medium (dead-relay surfaced only in review; remaining unknowns: how many legit hosts rely on it) |
| N5 | A single decision point for when debug writes may run — so new debug code cannot leak by omission | S | 7 `declare const __CELL_DEBUG__` sites, 3 helper copies (`debugLog.ts:6`, `ocrContentScript.ts:30-34`, `contentScriptMessages.ts:21-25`, `fetchInterceptor.iife.ts:24,67-69` `isDebug()`) + inline checks (`contentScriptLifecycle.ts:7,50`, `webTokenizeController.ts:69,367`, `logger.ts:1-4`) | high |

## Scope

- **In:** gating all residual ungated `dataset.ocr*`/`__ocr*`/`data-cell-debug-*`/`__CELL_*`/`__{YT,IQ,NF}_DEBUG` writes behind `isCellDebug()`; dedupe `cellDebug()`/`isDebug()` → one dependency-free gate helper (MAIN-world IIFE bundles cannot import `debugLog.ts` — it pulls `chrome-apis` — so the shared helper must carry no imports); `__CELL_AUTOLOAD_HANDLED` gated + origin-scoped; every cross-frame post targets an explicit origin (child→parent via `document.referrer`; host→child via the iframe's src-derived origin — `iframeManagerBridgeHost.ts:72` already has the `hasIframeWithOrigin` precedent) with `frameSrc`/`initiator` minimized to origin; inbound `__CELL_SUBTITLE_DISCOVERY` validated via the existing `subtitleSignalSchema`/`subtitleDiscoveryBridgePayloadSchema` (`entities/subtitle/discoverySchemas.ts:77-95`) + `event.origin` authoritative; repair the dead relay (add `nonce`).
- **Out:** `regionSelector.ts:412-413` `data-ocr-region-selecting` — functional CSS flag (`body[data-ocr-region-selecting="true"]` hides the panel, `regionSelector.ts:85`), not debug, not sensitive — gating it breaks panel-hide in production. `mediaScan.ts:156,181` `initiator: href` — chrome.runtime-internal path, never crosses a world boundary. Same-window `window.postMessage(msg, '*')` posts for `__YT_*`/`__IQ_*`/`__NF_*`/`__CELL_OCR_*`/`__CELL_OCR_TRACKS`/`__CELL_OCR_STATE` — same trust domain: a hostile page script posting or reading these only affects its own origin (it owns the underlying globals/video pixels already), and no channel can distinguish our IIFE from page scripts — accepted risk, matching the inbound `__CELL_OCR_TOGGLE`/`REGION_COMMAND` listeners (`ocrContentScript.ts:810-889`). `__*_CS_READY`/`__*_MAIN_WORLD_INJECTED` announcements — extension presence already detectable via mounted DOM. `chrome.runtime` messaging — separate registry schema. Already-gated markers (`mediaScan.ts:44-56`, `subtitleBridges.ts:51-57,83-99`, `debugLog.ts`, `episodeWatcher.ts:65-68`, `contentScriptMessages.ts:167,257,275`, `contentScriptLifecycle.ts:50`, `webTokenizeController.ts:367`) — verify, don't rework.
- **Non-goals:** redesigning the bridge to MessageChannel/`externally_connectable` (ports can't cross isolated↔main worlds anyway); CSP/sandbox changes; UI changes.

## Workflow

Narrative: A user opens an aggregator page embedding a third-party player iframe. Cell's ISOLATED content script runs in both frames; a MAIN-world IIFE runs inside the iframe to read player globals and `blob:` track bodies the isolated world cannot reach. The IIFE posts discovery signals to its own window (heard by its frame's content script) and to `window.parent` (heard by the top frame's content script, which intends to relay to the background — though that relay is silently dead today on a missing `nonce`). Meanwhile the OCR controller and various controllers write progress/debug markers onto `document.body.dataset` and `globalThis` for E2E observability — all of which share the DOM with the host page's scripts. The hardening pass wraps every internal write in the debug gate, narrows the parent post to the embedder's explicit origin, strips full URLs from relayed signals, repairs and validates whatever arrives over the bridge before it touches the subtitle cache.

## Journey

### AS-IS
1. User opens a page embedding a cross-origin player iframe; Cell's content scripts inject into both frames.
2. Inside the iframe, the MAIN-world discovery IIFE fetches a `blob:` subtitle body and posts `{type:'__CELL_SUBTITLE_DISCOVERY', signal:{url, body, initiator: location.href, ...}}` to `window` **and** `window.parent` with targetOrigin `'*'` (`subtitleDiscovery-main-world.iife.ts:91-105,149-157`) — any listener in the parent frame (including third-party scripts) receives the subtitle body plus the full iframe URL.
3. The user toggles OCR; `ocrController.init` writes `ocrInitStep` a→d and `ocrBgResponse` (full background JSON) onto `document.body.dataset` regardless of build (`ocrController.ts:30-43`); `__ocrCtrlTimings`/`__ocrStepTimings`/`ocrRecognizeError` land ungated (`ocrController.ts:91,100`, `ocrPipeline.ts:254`), `frameCapture` writes `__ocrCaptureDbg` per frame (`frameCapture.ts:31,33`), and the MAIN-world IIFEs publish `__YT_DEBUG`/`__IQ_DEBUG`/`__NF_DEBUG` carrying `lastVideoId`/`lastMovieId` — a `MutationObserver` on `<body>` in the host page reads them all.
4. An auto-load arrives at the iframe's controller, which posts `__CELL_AUTOLOAD_HANDLED {href, target: subtitleUrl, native: url}` to `window.parent` ungated (`contentScriptMessages.ts:181-190`) — and with `targetOrigin = location.origin` which can never equal a cross-origin parent, so the post is simultaneously leaky-in-intent and dead-in-practice. The Player Mode / Manager Sheet bridges likewise post `{frameSrc: location.href, state}` to `'*'` (`iframePlayerModeBridge.ts:305-308,331-334`, `iframeManagerBridgeChild.ts:28-31,50-53,61-64,103-106`, `iframeManagerBridgeHost.ts:40`).
5. Any embedded frame (ad, hostile embed) can `postMessage` a forged `__CELL_SUBTITLE_DISCOVERY` to the top window; the bridge accepts it (`event.source !== window`), trusts `signal.origin` (self-reported), and pushes the forged body into `cacheSubtitleBody` (`subtitleBridges.ts:44-64`) — a spoofed subtitle lands in the user's cache. The legitimate relay path is itself broken: the bridge forwards without `nonce` but the background schema requires it (`subtitleDiscoveryPayloadSchema`), so real iframe discovery signals are dropped while forged ones can still poison the cache.

### TO-BE
1. Same setup; frames inject as before.
2. The iframe's discovery IIFE posts the parent relay to `new URL(document.referrer).origin` — delivery fails closed if the embedder navigated or is unexpected; `initiator` carries `location.origin` only, so no path/query (and any embedded tokens) leave the iframe (`subtitleDiscovery-main-world.iife.ts`). Player Mode / Manager Sheet child→parent posts target the referrer origin, host→child posts target the iframe's src-derived origin — same fail-closed rule.
3. In production builds (`__CELL_DEBUG__='false'`), zero `dataset.ocr*`/`__ocr*`/`data-cell-debug-*`/`__CELL_*`/`__{YT,IQ,NF}_DEBUG` writes execute — every write is inside `isCellDebug()`; `CELL_E2E=1` builds emit them all exactly as today.
4. `__CELL_AUTOLOAD_HANDLED` posts only under `isCellDebug()` and targets the referrer origin — a debug aid that actually delivers where intended and is silent in production.
5. The bridge validates inbound discovery signals against `subtitleSignalSchema`, replaces self-reported `signal.origin` with browser-enforced `event.origin` before caching/relaying, drops malformed/forged posts, and forwards a real `nonce` — `cacheSubtitleBody` only stores signals from real frames and the legit iframe relay works again.

## Stories

- S1: As a user on an embed-aggregator site, I want Cell's internals invisible to the page's scripts so that what I watch can't be surveilled — done when production builds write nothing readable to shared DOM/globals and parent posts carry no full URLs.
- S2: As a user, I want subtitles I see to come from the real player, not an injected frame — done when inbound discovery signals are schema-validated and re-origined by `event.origin` before reaching the cache.
- S3: As a maintainer, I want one debug gate so new debug code can't leak by forgetting a check — done when all writes route through a single `isCellDebug` helper and `CELL_E2E=1` builds keep full observability.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Gating a write that an E2E/debug flow depends on without `CELL_E2E=1` | operational | E2E regressions, lost diagnostics | grep all readers of each marker before gating; `build-e2e` already sets the define (`scripts/build-e2e.mjs:25`) — stage2 suite re-run catches misses |
| `document.referrer` empty in some embed contexts (sandboxed iframe, `Referrer-Policy: no-referrer` on embedder) → parent relay silently stops | external | iframe subtitle discovery regresses on some hosts | fallback: referrer empty → skip parent relay (fail closed) + keep same-frame post; stage2 iframe spec validates the relay path |
| Over-strict inbound validation rejects a legitimate signal shape (player-state variants) | internal | discovery regression on real players | validate with the existing `subtitleSignalSchema` (`entities/subtitle/discoverySchemas.ts:77-95`) — the same schema the pipeline already uses — not a narrower subset |
| `event.origin` vs `signal.origin` mismatch on legitimate relayed signals | operational | signals dropped that worked before | record both; mismatch → trust `event.origin`, keep signal |
| Player Mode / Manager Sheet regressions when `'*'` → explicit origin (referrer empty, about:blank/blob iframe srcs, re-navigated iframes) | operational | functional features break on edge-case hosts | `iframeManagerBridgeHost.ts:72` `hasIframeWithOrigin` already validates origins one direction; extend same check to sends; stage2 Player Mode/Manager specs cover the flows |
| Duplicated debug gate left in one file | human | one file keeps leaking | grep for `__CELL_DEBUG__`/`isDebug(`/`cellDebug(` post-change — every bundle routes through the shared dependency-free gate (per-bundle `declare` unavoidable in MAIN-world IIFEs that can't import `chrome-apis`-coupled `debugLog.ts`) |

## Decision

go — real confidentiality leak (OCR'd text, subtitle bodies, page URLs readable by host-page scripts) + integrity hole (forged signals reach the subtitle cache); bounded S-cost fix on existing seam code, no new surface.

## Draft Acceptance Criteria

- [ ] In a production build, no `dataset.ocr*`, `__ocr*`, `data-cell-debug-*`, `__CELL_*`, or `__{YT,IQ,NF}_DEBUG` marker is written to DOM or globals (grep + runtime check on a mock page).
- [ ] Every remaining debug write routes through one shared dependency-free gate helper; `declare const __CELL_DEBUG__` survives only inside bundles that cannot import shared code (MAIN-world IIFEs), each wired to that helper's logic — no third copies.
- [ ] No cross-frame `postMessage(..., '*')` remains (`subtitleDiscovery-main-world`, `contentScriptMessages`, `iframePlayerModeBridge`, `iframeManagerBridgeChild`, `iframeManagerBridgeHost`); child→parent posts target `document.referrer` origin, host→child posts target the iframe's src-derived origin, and both fail closed when the origin cannot be established.
- [ ] Relayed discovery signals and bridge posts carry `initiator`/`frameSrc` as origins, never full `location.href`.
- [ ] Inbound `__CELL_SUBTITLE_DISCOVERY` from non-self sources is validated by `subtitleSignalSchema`, uses `event.origin` as the authoritative origin before `cacheSubtitleBody`/relay, and the forwarded message carries a `nonce` satisfying `subtitleDiscoveryPayloadSchema`.
- [ ] `data-ocr-region-selecting` remains ungated and functional — the panel still hides during region selection in production.
- [ ] `CELL_E2E=1` builds emit all markers exactly as today; existing stage2 specs stay green.
