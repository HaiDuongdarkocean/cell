---
name: testing-extension-browser
description: Real-Chrome Playwright verification for the Cell extension via packed .crx + cloned profile. Use for ad-hoc real-browser verification.
---

# Testing Extension Browser

## Overview

**Two-phase workflow: `setup-cell-profile.py` packs the extension + clones the profile; Playwright persistent Chromium with that clone launches, navigates, and tests.**

Four principles:

1. **Environment prep is always step 1.** `script/launch-cell-context.mjs` owns build→pack+clone→warm-up→launch — test scripts `import { prepareCellEnvironment, warmUpCellContext, launchCellContext }` instead of writing a new launcher.
2. **uBlock rides with Cell.** Both are loaded via `--load-extension=<dist>,<uBOLite>` — never rely on External Extensions JSON on Windows.
3. **Clone, don't share.** Each run clones from master — parallel agents never collide on the profile lock.
4. **Contract before click.** Define "pass" as a concrete DOM state before interacting. "It works" is not a contract.

**Stealth path when Chromium is bot-flagged or real Chrome is required** (YouTube, Netflix): `script/stealth_cell_browser.py` (`uv run --with nodriver`, import the `stealth_cell_browser` module) launches the installed Chrome and session-loads Cell + uBOLite via **CDP `Extensions.loadUnpacked`** — bypasses the Chrome 137+ `--load-extension` block without a profile clone. Same loop applies: `launch()` → `gate_extension()` → navigate/trigger/verify.

## When to Use

- Any Cell browser test; verifying a fix on a real page; shadow DOM inspection or event dispatch; bugs that only appear on a specific host page

**When NOT to use:** non-extension pages → Playwright with a temporary profile; performance traces → `chrome-devtools` MCP; headless CI → `npm run test:e2e` (Playwright fixtures); unit tests → `npm run test:unit`.

## The Test Loop

```
0. Contract → 1. Build → 2. Pack+Clone → 3. Warm-up launch → 4. Connect (Playwright persistent context) → 5. Navigate → 6. Trigger → 7. Verify → 8. Cleanup
```

Each arrow has a guard — do not advance until it passes.

| Step | Done when |
|---|---|
| 0. Contract | Given/When/Then names concrete DOM element, count, text, or class + ALL preconditions |
| 1. Build | Build exits 0 + `dist/manifest.json` exists (+ `dist/seed/` when dictionary seed needed → `npx vite build --mode development`) |
| 2. Pack + Clone | `prepareCellEnvironment()` (wraps `setup-cell-profile.py`) prints `CLONE_PATH=C:\cell-browser-sessions\sessions\cell-<uuid>` |
| 3. Warm-up | `warmUpCellContext(CLONE_PATH)` — first open/close primes the clone so the extension is fully installed on the next launch. |
| 4. Connect | `launchCellContext(CLONE_PATH)` resolves + Cell listed in `chrome://extensions` (or `fetchPatched: true`) |
| 4. Navigate | `page.goto(url)` resolves + target element visible |
| 5. Trigger | `page.evaluate(...)` / `locator.click()` succeeds + target has non-empty text |
| 6. Verify | Contract's "Then" passes with DOM evidence — repeated 2–3× |
| 7. Cleanup | `context.close()` + clone dir deleted |

## Hard-won rules (do not relearn the hard way)

- **Google Chrome 137+ blocks `--load-extension` and `external_crx` on Windows.** Two paths: **Playwright bundled Chromium** + clone + `--load-extension` (merge gate, but bot-flagged by YouTube), or **nodriver + CDP `Extensions.loadUnpacked`** (`stealth_cell_browser.py`, stealth session, extensions gone on exit — re-load per launch). Packed `.crx` + External Extensions JSON is for Linux/macOS only. After each `npm run build`, re-pack with `--rebuild`.
- **Stealth/nodriver evaluate quirks:** `evaluate()` doesn't await promises → stash async results in `window.__r_*` and poll; returns CDP `[[key,{type,value}]]` pairs → normalize (`ev()` handles both). Inline `<script>` injection is CSP-blocked on YouTube — `evaluate()` the source directly instead. `xhrPatched`/`fetchPatched` toString() probes are false-negative: uBOLite re-wraps after `document_start` while still calling ours — gate on `__YT_MAIN_WORLD_INJECTED`, verify hooks functionally.
- **uBlock is ALWAYS loaded alongside Cell via `--load-extension=dist,data/extension/uBOLite`** (comma-separated, same flag + same `--disable-extensions-except` list). The External Extensions JSON written by `setup-cell-profile.py` does NOT install anything on Windows — the uBlock .crx packs fine yet silently never loads. `data/extension/uBOLite` + `ublock-key.pem` are gitignored — copy them from the main repo into a fresh worktree before setup.
- **Never hand-roll a launcher.** `script/launch-cell-context.mjs` exposes `prepareCellEnvironment({rebuild})`, `warmUpCellContext(clonePath)`, `launchCellContext(clonePath)` — new test scripts import these and start at navigate/trigger/verify.
- **Autoplay blocks `video.play()` from script** — click the play button first, then seek via `page.evaluate`.
- **Shadow DOM:** `page.evaluate` CAN reach open `shadowRoot`s; `caretRangeFromPoint` CANNOT (use `shadowRoot.elementFromPoint`); events need `composed: true` dispatched on `document`.
- **`page.evaluate` does not await promises in the page** — use sync IIFEs, or `page.evaluate` with an async arrow and wait for the returned Promise.
- **`chrome.storage` is undefined in page world** — inspect DOM attributes instead.
- **One Chrome per clone** — launch fails with profile lock → `context.close()` the old one, wait 3s, retry.
- **Verify probe:** `fetchPatched: true` is the strongest liveness signal (runs `document_start`, MAIN world, `<all_urls>`). `subtitleRoot` false on a video-less page is not a failure.

→ Step-by-step actions and code snippets (video seek, shadow DOM inspection, composed event dispatch, popup check), evidence-capture template: `references/workflow-detail.md`
→ Symptom→cause→falsify table, SSOT paths, setup check, test sites, timeboxing: `references/troubleshooting.md`

## Anti-Patterns (top offenders)

Forbidden unless justified with evidence:

- Launching without building first; editing `dist/` directly; copying `dist/` elsewhere
- `--load-extension` on **Google Chrome** 137+ or `external_crx` on Windows; CDP `loadUnpacked` is session-only; Preferences `location=4` gets stripped. Use Playwright Chromium + warm-up.
- Writing a new Playwright launcher instead of importing `script/launch-cell-context.mjs`; loading Cell alone without uBlock
- Killing the Chrome process with `Stop-Process` / `taskkill` (skips `context.close()` → clone leak)
- Declaring pass after one successful test — repeat ≥2×
- Treating DOM text as user-visible behavior — check rendered rect, opacity, display

## Pause at Certainty

Before declaring pass: What DOM evidence did I check? Did I repeat the trigger ≥2×? Is the target visible (`getBoundingClientRect` non-zero)? Could a stale build explain this? Did I clean up the clone?

If the last answer is no, the test is not complete.

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
