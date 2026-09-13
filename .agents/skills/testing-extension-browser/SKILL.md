---
name: testing-extension-browser
description: Stealth-Chrome interactive testing for the Cell extension via nodriver + CDP. Use for ad-hoc real-browser verification.
---

# Testing Extension Browser

## Overview

**Two-phase workflow: `setup-cell-profile.py` packs the extension + clones the profile; MCP stealth-chrome-devtools spawns, navigates, and tests.**

Three principles:

1. **Build before launch.** The script loads from `dist/`, not `src/` — a stale build is the most common false failure.
2. **Clone, don't share.** Each run clones from master — parallel agents never collide on the profile lock.
3. **Contract before click.** Define "pass" as a concrete DOM state before interacting. "It works" is not a contract.

## When to Use

- Any Cell browser test; verifying a fix on a real page; shadow DOM inspection or event dispatch; bugs that only appear on a specific host page

**When NOT to use:** non-extension pages → `chrome-devtools` MCP directly; performance traces → `chrome-devtools`; headless CI → `testing-with-playwright`; unit tests → `npm run test:unit`.

## The Test Loop

```
0. Contract → 1. Build → 2. Pack+Clone → 3. Connect (MCP spawn) → 4. Navigate → 5. Trigger → 6. Verify → 7. Cleanup
```

Each arrow has a guard — do not advance until it passes.

| Step | Done when |
|---|---|
| 0. Contract | Given/When/Then names concrete DOM element, count, text, or class + ALL preconditions |
| 1. Build | Build exits 0 + `dist/manifest.json` exists (+ `dist/seed/` when dictionary seed needed → `npx vite build --mode development`) |
| 2. Pack + Clone | `setup-cell-profile.py` prints `CLONE_PATH=C:\stealth-mcp-browser-sessions\sessions\cell-<uuid>` |
| 3. Connect | `spawn_browser` returns `state: "ready"` + Cell listed in `chrome://extensions` (or `fetchPatched: true`) |
| 4. Navigate | Page loaded + target element visible |
| 5. Trigger | Dispatch returns `dispatched: true` + target has non-empty text |
| 6. Verify | Contract's "Then" passes with DOM evidence — repeated 2–3× |
| 7. Cleanup | `close_instance` + clone dir deleted |

## Hard-won rules (do not relearn the hard way)

- **Chrome 137+ blocks every unpacked load path** — `--load-extension` doesn't load at all; CDP `loadUnpacked` is session-only; Preferences `location=4` gets stripped. The only working path: **packed .crx + External Extensions JSON** via `setup-cell-profile.py`. After each `npm run build`, re-pack with `--rebuild`.
- **Autoplay blocks `video.play()` from script** — click the play button first, then seek via `execute_script`.
- **Shadow DOM:** `execute_script` CAN reach open `shadowRoot`s; `caretRangeFromPoint` CANNOT (use `shadowRoot.elementFromPoint`); events need `composed: true` dispatched on `document`.
- **`execute_script` does not await promises** — use sync IIFEs.
- **`chrome.storage` is undefined in page world** — inspect DOM attributes instead.
- **One Chrome per clone** — spawn fails with profile lock → `close_instance` the old one, wait 3s, retry.
- **Verify probe:** `fetchPatched: true` is the strongest liveness signal (runs `document_start`, MAIN world, `<all_urls>`). `subtitleRoot` false on a video-less page is not a failure.

→ Full step-by-step actions, MCP tool table, code snippets (video seek, shadow DOM inspection, shadow click dispatch, popup check), evidence-capture template, example walkthrough: `references/workflow-detail.md`
→ Failure patterns, extension test traps, anti-patterns, SSOT paths, test sites, timeboxing: `references/troubleshooting.md`

## Anti-Patterns (top offenders)

Forbidden unless justified with evidence:

- Launching without building first; editing `dist/` directly; copying `dist/` elsewhere
- `--load-extension` / CDP `loadUnpacked` handoff / Preferences `location=4` — all dead on Chrome 137+
- `Stop-Process` on Chrome (skips cleanup → clone leak)
- Declaring pass after one successful test — repeat ≥2×
- Treating DOM text as user-visible behavior — check rendered rect, opacity, display

## Pause at Certainty

Before declaring pass: What DOM evidence did I check? Did I repeat the trigger ≥2×? Is the target visible (`getBoundingClientRect` non-zero)? Could a stale build explain this? Did I clean up the clone?

If the last answer is no, the test is not complete.

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
