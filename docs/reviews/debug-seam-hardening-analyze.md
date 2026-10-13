# Review — debug-seam-hardening (analyze)

Fresh-context adversarial review of `docs/intent/debug-seam-hardening.md`.

## Findings vs corrections applied

| # | Finding | Applied fix |
|---|---|---|
| 1 | `ocrRegionSelecting` miscited (`ocrContentScript.ts:412`) and misclassified — the write is `regionSelector.ts:412-413`, a functional CSS flag (`body[data-ocr-region-selecting]` hides the Universal Panel during region select); gating it ships a production bug | Removed from N1/gate list; added explicit Out + AC asserting it stays ungated and functional |
| 2 | `frameCapture.ts:31,33` `__ocrCaptureDbg` (ungated, per-frame) missing from inventory | Added to N1 + AS-IS step 3 + AC1 |
| 3 | N2 unenumerated: 6 child→parent + 3 host→child `'*'` posts in `iframePlayerModeBridge.ts:180,195,305-308,331-334`, `iframeManagerBridgeChild.ts:28-31,50-53,61-64,103-106`, `iframeManagerBridgeHost.ts:40` — same leak class (`frameSrc: location.href`) | Scoped IN; enumerated in N2/AS-IS/TO-BE/AC3; added Player Mode/Manager Sheet regression risk row citing `hasIframeWithOrigin` precedent (`iframeManagerBridgeHost.ts:72`) |
| 4 | N3 incomplete: `fetchInterceptor.iife.ts:189,238` `initiator: location.href` reaches the pipeline via the nonce'd same-window relay (`subtitleBridges.ts:136-151`); `mediaScan.ts:156,181` is chrome.runtime-internal | `fetchInterceptor` added to N3; `mediaScan` explicitly Out with rationale |
| 5 | N5/AC "exactly one `declare`" unachievable: 7 `declare` sites, 3 helper copies + inline checks; MAIN-world IIFE bundles can't import `debugLog.ts` (pulls `chrome-apis`) | AC2 restated: one shared dependency-free gate helper; `declare` survives only inside bundles that can't import shared code |
| 6 | N4 stale: legit relay is dead today — `subtitleBridges.ts:58-61` forwards without `nonce`, `subtitleDiscoveryPayloadSchema` requires `z.string().min(16)` → background rejects; live hole is `cacheSubtitleBody` (size/format-only checks) before validation | N4/AS-IS step 5/TO-BE step 5/AC5 rewritten: validate before cache + add `nonce` to repair relay; N4 confidence → medium |
| 7 | `__Tihoka_OCR_TRACKS`/`__Tihoka_OCR_STATE` same-window exclusion rationale was false (message events aren't listener-scoped; page can read cue text / trigger `__Tihoka_OCR_TOGGLE`/`REGION_COMMAND` listeners) | Re-based on the correct rationale: same trust domain — a hostile page script only affects its own origin and no channel distinguishes our IIFE from page scripts; accepted risk matching the `__YT_*` non-goal |
| 8 | `cacheSubtitleBody` described as "unvalidated" — minimal size/format checks exist | Restated: gap is schema/origin validation, not absence of checks |
| 9 | Doc cited TS `SubtitleSignal` union (can't validate at runtime) | Corrected to `subtitleSignalSchema`/`subtitleDiscoveryBridgePayloadSchema` (`entities/subtitle/discoverySchemas.ts:77-95`) — already used at `subtitleDiscovery/pipeline.ts:47` |
| 10 | `__YT_DEBUG`/`__IQ_DEBUG`/`__NF_DEBUG` + `__*_MAIN_WORLD_INJECTED` ungated MAIN-world writes uncovered | `__*_DEBUG` (carry `lastVideoId`/`lastMovieId`) scoped INTO N1 + AC1; `__*_MAIN_WORLD_INJECTED` explicitly Out (presence already detectable via mounted DOM) |

## Gate checklist

- Journey: AS-IS 5 steps, TO-BE 5 steps, ends at promised value ✓
- `ui_surface: no` — consistent, no user-visible journey step ✓
- Decision `go` supported by risk register ✓
- Confidence honest after N4 downgrade ✓
- Needs N5 rephrased need-side (single decision point vs mechanism) ✓

Core thesis verified (ungated debug writes, `'*'` parent relay with href payloads, cache-poisoning inbound path); all required corrections applied to the intent above.

VERDICT: APPROVE_WITH_CHANGES
