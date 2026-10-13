# Plan — debug-seam-hardening

Spec: `docs/specs/debug-seam-hardening.md` · ui_surface: no · mode: all · size: S

## Tasks

| # | Task | AC | Deps |
|---|---|---|---|
| 1 | Shared dependency-free gate `src/shared/lib/TihokaDebug.ts`; `debugLog.ts` re-exports; replace helper copies (`ocrContentScript.ts:30-34`, `src/features/subtitle/ui/contentScriptMessages.ts:21-25`, `fetchInterceptor.iife.ts` `isDebug()`) + inline checks (`ocrContentScript.ts:901`, `contentScriptLifecycle`, `webTokenizeController`, `logger`) | AC-2 | — |
| 2 | Gate ungated writes: `ocrController.ts` (:30-59,:91,:100), `ocrPipeline.ts:254`, `src/features/ocr/pipeline/frameCapture.ts:31,33`, `contentScriptMessages.ts:181-190` `__Tihoka_AUTOLOAD_HANDLED`; add `declare`+gate `__YT_DEBUG`/`__IQ_DEBUG`/`__NF_DEBUG` publishes in 3 site IIFEs | AC-1 | 1 |
| 3 | Origin-resolution helpers in shared lib: `isResolvableHttpOrigin`, `resolveParentFrameOrigin` (`ancestorOrigins[0]`→referrer) | AC-3 | — |
| 4 | Explicit-origin sends + minimized payloads: `subtitleDiscovery-main-world.iife.ts:101` + `initiator`→origin; `mediaScan.ts:47` send target; `iframePlayerModeBridge` 4 posts; `iframeManagerBridgeChild` 4 posts; `iframeManagerBridgeHost.postToIframe`; `frameSrc`→origin+pathname | AC-3, AC-4 | 3 |
| 5 | Inbound `__Tihoka_SUBTITLE_DISCOVERY` validation in `subtitleBridges.ts` (both paths): http(s) `event.origin` → `subtitleSignalSchema` → override origin/initiator → cache → nonce'd forward | AC-5 | — |
| 6 | PM/MGR inbound checks: `installIframePlayerModeBridge` (`e.source` is iframe contentWindow + frameSrc↔origin), `installManagerSheetBridge` (frameSrc↔origin), child-side listeners (`iframePlayerModeBridge`, `subtitlePlayerMode`, `iframeManagerBridgeChild`) bound to resolved parent origin | AC-8 | 3 |
| 7 | Unit tests: gate helper, discovery validation (malformed/null-origin/forged → no cache), origin resolution, PM/MGR inbound forged-send drops | AC-1..8 | 1-6 |
| 8 | Gates `typecheck && lint && test:unit && build`; stage2 spot-check (subtitle discovery iframe spec + PM/manager specs); `docs/2-architechture-system.md` seam section if present | all | 7 |

## Notes

- `data-ocr-region-selecting`, `data-tihoka-player-mode*`, `dataset.tihokaPlayerMode` stay ungated (functional).
- Debug-gated sends keep full `href`/`pageUrl` (E2E asserts on them).
- Wire nonce NOT added — receiver generates forwarded nonce (spec REQ-5 Rules).
- Accepted risks recorded in spec Open Questions: `apiKeys` residual, empty ancestorOrigins/referrer, well-formed forgery bounded to per-frame cache.
