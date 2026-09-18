# Todo — debug-seam-hardening

Plan: `tasks/plan-debug-seam-hardening.md` · Spec: `docs/specs/debug-seam-hardening.md`

| # | Task | Priority | Parallel | Blocked strategy | Status |
|---|---|---|---|---|---|
| 1 | Shared `src/shared/lib/cellDebug.ts` SSOT + replace helper copies/inline checks | P0 | yes (with 3) | — | done |
| 2 | Gate ungated debug writes (ocrController/ocrPipeline/frameCapture/AUTOLOAD_HANDLED/3 site-IIFE `__*_DEBUG`) | P0 | no — needs 1 | wait 1 | done |
| 3 | `shared/lib/dom/frameOrigin.ts` — `isResolvableHttpOrigin`, `resolveParentFrameOrigin`, `resolveIframeOrigin` | P0 | yes (with 1) | — | done |
| 4 | Explicit-origin sends + minimized `initiator`/`frameSrc` (subtitleDiscovery iife, fetchInterceptor, mediaScan, PM bridge, MGR child/host) | P0 | no — needs 3 | wait 3 | done |
| 5 | Unified inbound `__CELL_SUBTITLE_DISCOVERY` validation + receiver-generated nonce relay | P0 | yes | — | done |
| 6 | PM/MGR inbound source/origin/frameSrc checks (top + child sides) | P0 | no — needs 3 | wait 3 | done |
| 7 | Unit tests: cellDebug, frameOrigin, subtitleBridges validation/nonce, PM/MGR forged drops | P1 | no — needs 1-6 | wait | done |
| 8 | Gates + real-Chrome verify (iframe relay, PM, MGR sheet, debug markers) + arch doc + verify artifact | P0 | no — needs all | wait | done |

## Discovered during build

- `subtitleDiscovery-main-world.iife.ts` `scanTracks` missed a `<track>` added as a direct mutation node (`querySelectorAll` only scans descendants) — dynamic blob tracks never produced `network-response`. Fixed: added-node-is-TRACK early branch. Verified in real Chrome via `data-cell-iframe-discovery-log`.
- Existing `iframeManagerBridgeChild.test.ts`/`contentScriptMessages.test.ts` updated for explicit origins + debug gate.
- `playwright.stream.config.ts` gained the `--stream-iframe` webServer (ports 4323/4324 hardcoded by `streamFlixData.PLAYER_ORIGIN`).

## Verify round 1 (fresh-context, subagent) — FAIL → fixes applied

- `iframeManagerBridgeHost.ts` lacked `event.source`/`event.origin` checks → added `isIframeContentWindow` (shared into `frameOrigin.ts`) + `isResolvableHttpOrigin` + `hasIframeWithOrigin` + `resolveIframeOrigin`.
- Player Mode EXIT lacked `frameSrc` corroboration → `frameSrcMatchesOrigin` now applies to ENTER and EXIT.
- `iframeManagerBridgeHost.test.ts` created (7 tests: forged top-window, foreign/opaque origin, lying frameSrc, valid accept + explicit-origin ack/replies).

## Final evidence

- Gates (fresh, post-fix): `npm run typecheck` PASS · `npm run lint` PASS · `npm run test:unit` 6579/6579 PASS · `npm run build` PASS
- E2E: `e2e/stage2/debug-seam-hardening.spec.ts` 1/1 PASS (re-run post-fix); regression `subtitle-tokenization` + `extension-manager`/`popup-status-keys`/`card-creator-*` green earlier
- Verify artifact (fresh-context, round 2): `docs/reviews/debug-seam-hardening-verify.md` — all 8 ACs PASS, no spec violations; residual risks documented (hostile-iframe self-elevation, no session binding, embedder-page spoofing — inherent postMessage limits, follow-up candidates)

VERDICT: PASS
