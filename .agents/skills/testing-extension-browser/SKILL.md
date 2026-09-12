---
name: testing-extension-browser
description: Launch stealth Chrome with Cell + uBlock via nodriver, then test features in-browser using stealth-chrome-devtools MCP (navigate, click, inspect shadow DOM, dispatch events, verify popup). Use when starting any Cell browser test, after rebuild, when verifying a fix on a real page, or when a fresh agent needs the test browser. Not for non-extension pages, performance traces, or headless CI without MCP.
---

# Testing Extension Browser

## Overview

**Two-phase workflow: nodriver launches Chrome + loads extensions, MCP navigates + tests the feature.**

This skill runs on three principles:

1. **Build before launch.** The script loads from `dist/`, not `src/`. A stale build is the most common false failure.
2. **Clone, don't share.** Each run clones from master — 20 agents can run in parallel without profile lock collisions.
3. **Contract before click.** Define what "pass" means as a concrete DOM state before interacting. "It works" is not a contract.

The goal is not to click around until something looks right. It is to drive the page to a known state, trigger the feature, and prove the outcome with a DOM check that another agent can repeat.

## What This Skill Stores

This skill stores **methodology** and **diagnostic patterns** for browser testing, not code techniques or opinions.

| Term | Meaning | Good example | Bad example |
|---|---|---|---|
| **Methodology** | Reusable way to set up and run a browser test. | Two-phase: nodriver creates clone with extension, MCP reuses clone profile. | "Use `execute_script` to click things." |
| **Diagnostic pattern** | Signature you recognize after applying the methodology. | "Popup not opening → check panel shadow children count, not just DOM text." | "The browser is slow." |
| **Technique** | Concrete coding move. | — | "Dispatch `MouseEvent` with `composed: true`." |
| **Opinion** | Unverified preference. | — | "Headless is always better." |
| **Symptom** | Visible test failure. | — | "Popup doesn't open." |

Code snippets belong in examples. Symptoms belong in the failure patterns table. This skill stores methodology and the patterns that emerge from it.

## When to Use

- Starting any Cell browser test.
- After a rebuild — verify the new build loads and runs.
- Verifying a fix on a real page.
- A fresh agent needs the test browser setup.
- Testing a feature that requires shadow DOM inspection or event dispatch.
- Reproducing a bug that only appears on a specific host page.

**When NOT to use:**

- Testing non-extension pages (use `browser-testing-with-devtools` directly).
- Performance traces or flame graphs (use `chrome-devtools` MCP).
- Headless CI without MCP access (use Playwright).
- Unit tests or integration tests (use `npm run test:unit`).

## The Test Loop

```
0. Contract → 1. Build → 2. Launch (nodriver: Chrome + extensions only) → 3. Connect (MCP spawn_browser) → 4. Navigate (MCP navigate) → 5. Trigger → 6. Verify → 7. Cleanup
```

Each arrow has a **guard**. If the guard fails, go back. Do not advance until the guard passes.

## Step 0: Contract

**Purpose:** Turn the test goal into an observable Given/When/Then.

**Template:**
```
Given: <exact starting state — page loaded, video playing, settings>
When: <exact user or system action — click, seek, dispatch event>
Then: <exact visible or measurable DOM outcome — element count, text, class>
```

**Example:**
```
Given: themoviebox.org video playing at t=190s, subtitle overlay visible, tokenize OFF
When: click word on subtitle target line
Then: #cell-universal-panel-host shadow children > 2 (popup opened)
```

**Guard:** Contract names a concrete DOM element, count, text, or class. "It works" is not a contract.

**Loop back:** Request is vague. Invoke `/interview-me` on yourself. Only ask the user if `/interview-me` fails.

## Step 1: Build

**Purpose:** Ensure `dist/` has the latest code — the script loads from `dist/`, not `src/`.

**Actions:**
- For most tests, run `npx vite build` (or `npm run build`).
- For tests that need the bundled dictionary/frequency seed (dictionary popup, word status, etc.), run `npx vite build --mode development` instead. Dev mode copies `data/resource/` into `dist/seed/` so the extension auto-seeds without requiring a manual import.
- Confirm `[design-system-showcase]` or `auto-seed-assets` line appears (build completed).

**Guard:** Build exits 0 + `dist/manifest.json` exists (+ `dist/seed/` present when dev build needed).

**Loop back:** Build fails → fix build errors first. Do not launch with a stale build — you will test old code and chase ghosts.

## Step 2: Pack .crx + Setup Clone Profile

**Purpose:** Pack Cell (and uBlock) into a .crx, clone master profile, and write External Extensions JSON so MCP `spawn_browser` auto-loads the extension on launch. No nodriver, no debugging port — MCP stealth handles anti-bot.

**Chrome 137+ root cause (verified on Chrome 151):** All unpacked-extension load methods are blocked or session-only:
- CDP `loadUnpacked`: session-only (close = lost, NOT persisted to Preferences).
- `--load-extension` flag: completely blocked (doesn't load at all).
- Preferences `location=4` (unpacked): stripped on launch.
- MCP `execute_cdp_command`: no Extensions CDP domain.

**Solution: packed .crx + External Extensions JSON.** Chrome 151 still accepts a packed .crx referenced by `<profile>/Default/External Extensions/<id>.json`. Chrome installs the .crx on launch, the extension persists across spawns, and MCP `spawn_browser` auto-loads it — no debugging port needed.

```powershell
python .agents\skills\testing-extension-browser\script\setup-cell-profile.py
```

**Flags:** `--rebuild` (force re-pack .crx after `npm run build`) · `--no-ublock` · `--keep-profile`

**Guard:** script prints `[OK] Packed cell.crx` → `[OK] Cloned master → <clone>` → `[OK] External Extensions JSON` → `CLONE_PATH=C:\stealth-mcp-browser-sessions\sessions\cell-<uuid>`.

**Loop back:** `Pack failed` → `dist/` missing or `openssl` not in PATH → back to Step 1. `cell-key.pem` missing → script auto-generates it (one-time).

**One-time setup:** `cell-key.pem` and `ublock-key.pem` are generated on first run. The .crx ID is derived from the key (stable across re-packs). After each `npm run build`, run `setup-cell-profile.py --rebuild` to re-pack the .crx with the new code.

**Verify probe contract (Step 4):** `fetchPatched: true` is the strongest signal — `fetchInterceptor` runs at `document_start` in the MAIN world on every `<all_urls>` page and patches `window.fetch` before page JS. `panelHost: true` confirms the universal panel mounted. `subtitleRoot`/`subtitleShadow` are only present on pages with a video, so `false` there is not a failure.

## Step 3: Connect (MCP)

**Purpose:** Spawn a stealth-chrome-devtools browser instance reusing the clone profile. Extensions auto-load from the External Extensions JSON (written in Step 2).

**Actions:**
- `mcp_call_tool stealth-chrome-devtools spawn_browser` with `user_data_dir = "C:\stealth-mcp-browser-sessions\sessions\cell-<uuid>"` (the CLONE_PATH from Step 2) and `headless = false`.
- Save the returned `instance_id` — all subsequent MCP calls use it.

**Guard:** `state: "ready"` in spawn response. Then navigate to `chrome://extensions/` and verify Cell is listed (count should be 4: Cell + 3 base extensions). Or navigate to any URL and check `fetchPatched: true` via `execute_script`.

**Loop back:** Spawn fails (profile locked) → a previous MCP instance didn't close → `close_instance` on the old instance, wait 3s, retry. Cell not listed → External Extensions JSON missing or .crx path wrong → re-run Step 2.

## Step 4: Navigate (MCP)

**Purpose:** Drive the page to the state needed for testing. MCP handles all navigation — the nodriver script does NOT navigate.

**Actions:**

| Step | MCP tool | When |
|---|---|---|
| Navigate to URL | `navigate` | Always — load test page |
| Click element | `click_element` | Play button, toggle, etc. |
| Execute JS | `execute_script` | Seek video, inspect DOM, dispatch events |
| Query elements | `query_elements` | Find elements by selector |
| Screenshot | `take_screenshot` | Visual verification |

**Guard:** Page loaded + target element visible before interacting.

**Loop back:** Element not found → page not ready → wait or re-navigate.

### Video playback

Autoplay policy blocks `video.play()` from script. Click the play button first:

```
click_element selector=".art-control-playAndPause"
```

Then seek via `execute_script`:

```js
(() => { const v = document.querySelector('video'); v.currentTime = 190; return { time: v.currentTime }; })()
```

### Shadow DOM inspection

Cell subtitle overlay lives in `#cell-subtitle-root` shadow root. `execute_script` runs in page main world — it CAN access `shadowRoot` (open mode):

```js
(() => {
  const root = document.querySelector('#cell-subtitle-root');
  const sr = root?.shadowRoot;
  const target = sr?.querySelector('[data-role="target"] span');
  return { hasRoot: !!root, hasShadow: !!sr, targetText: target?.textContent };
})()
```

**Guard:** `hasShadow: true` before inspecting shadow children.

## Step 5: Trigger

**Purpose:** Fire the action that the contract's "When" describes.

**Actions:**
- Click element via `click_element` (for page-level buttons).
- Dispatch event via `execute_script` (for shadow DOM elements or synthetic interactions).

### Dispatch click on shadow DOM element

`webTriggerController` listens to `mouseup` on `document`. Events from shadow DOM bubble out with `composed: true`:

```js
(() => {
  const root = document.querySelector('#cell-subtitle-root');
  const sr = root?.shadowRoot;
  const target = sr?.querySelector('[data-role="target"] span');
  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 3;
  const cy = rect.top + rect.height / 2;
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, clientX: cx, clientY: cy }));
  return { dispatched: true, cx: Math.round(cx), cy: Math.round(cy) };
})()
```

**Guard:** Dispatch returns `{ dispatched: true }` + target element has non-empty text.

**Loop back:** Target text empty → cue not active → seek to different timestamp.

## Step 6: Verify

**Purpose:** Prove the feature works (or capture evidence it doesn't).

**Actions:**
1. Inspect result DOM (popup opened, class added, element count changed).
2. Repeat trigger + verify 2-3 times to confirm reproducibility.

### Check popup opened

```js
(() => {
  const panel = document.querySelector('#cell-universal-panel-host');
  const sr = panel?.shadowRoot;
  const allEls = sr?.querySelectorAll('*');
  return { totalEls: allEls?.length };
})()
```

**Pass:** `totalEls > 2` (popup content rendered). **Fail:** `totalEls === 2` (only style + empty div).

**Guard:** Contract's "Then" clause passes with concrete DOM evidence. Repeat 2-3 times.

**Loop back:** Verify fails → capture evidence (DOM snapshot, element count) → invoke `/debugging-and-error-recovery`.

## Step 7: Cleanup

**Purpose:** Free resources, prevent clone leak.

**Actions:**
1. `mcp_call_tool stealth-chrome-devtools close_instance` with `instance_id`.
2. `Remove-Item C:\stealth-mcp-browser-sessions\sessions\cell-* -Recurse -Force -ErrorAction SilentlyContinue`

**Guard:** Clone dir deleted.

## Guard Reference

| Step | Input | Output | Done when |
|---|---|---|---|
| 0. Contract | Test goal | Given/When/Then | Names concrete DOM/count/text |
| 1. Build | Source code | `dist/` updated | Build exits 0 + manifest exists |
| 2. Pack + Setup | `dist/` | `.crx` + clone with External Extensions JSON | `CLONE_PATH=...` printed |
| 3. Connect | Clone path | MCP instance_id | `state: "ready"` + Cell in `chrome://extensions` |
| 4. Navigate | instance_id + URL | Page loaded + element visible | Target element found |
| 5. Trigger | Page state | Feature action fired | Dispatch returns `dispatched: true` |
| 6. Verify | Triggered state | Contract pass/fail | DOM evidence matches "Then" clause |
| 7. Cleanup | instance_id | Resources freed | Clone dir deleted |

## Common Failure Patterns

| Symptom | Likely cause | Falsify by |
|---|---|---|
| `[PASS]` but feature not found | Stale `dist/` — built before code change | Rebuild + `setup-cell-profile.py --rebuild` |
| MCP `spawn_browser` shows no Cell in `chrome://extensions` | External Extensions JSON missing or .crx path wrong | Re-run `setup-cell-profile.py`; check `<clone>/Default/External Extensions/<id>.json` exists |
| `Pack failed` in setup-cell-profile.py | `openssl` not in PATH or `dist/` missing | Run `npm run build`; verify `openssl version` works |
| Clone `Preferences` `extensions.settings` empty after launch | Chrome strips hand-written `location=4` unpacked entries — use .crx + External Extensions instead | Don't pre-install unpacked via Preferences; use `setup-cell-profile.py` |
| MCP spawn fails (profile locked) | Previous MCP instance didn't close | `close_instance` on old instance, wait 3s, retry |
| Marker not found | Content script didn't inject | Re-run setup; check `fetchPatched: true` via `execute_script` |
| `execute_script` returns null | Async code — MCP doesn't await promises | Use sync IIFE, not `async` |
| `chrome.storage` undefined | Page world has no `chrome.runtime` | Inspect DOM attributes instead |
| Click on shadow element no effect | Event not `composed: true` | Add `composed: true` to MouseEvent |
| `caretRangeFromPoint` returns non-text | Doesn't pierce shadow DOM | Use `shadowRoot.elementFromPoint` |
| Target text empty | Cue not active at current time | Seek to different timestamp |
| Popup `totalEls === 2` | Feature didn't trigger or failed | Re-check trigger + capture DOM |
| Clone leak after kill hard | `Stop-Process` skips cleanup | `Remove-Item` sessions manually |
| Python encoding error | Wrong Python version | Use `uv run --python 3.11` |

## Browser Extension Test Traps

| Trap | Why | Falsify by |
|---|---|---|
| Stale build | Script loads `dist/`, not `src/` | Check `dist/manifest.json` timestamp vs last edit |
| Profile lock | Two processes on same clone | Only one Chrome per clone at a time |
| Shadow DOM invisible to `caretRangeFromPoint` | API doesn't pierce shadow | Use `shadowRoot.elementFromPoint` |
| Autoplay blocked | Browser policy | Click play button first, then seek |
| Event retargeting | Shadow events retarget to host | Use `composed: true` + dispatch on `document` |
| Content script not injected | Page reloaded before script ready | Script does `--no-reload` if needed |
| uBlock blocks test resource | Ad/resource filtered | Use `--no-ublock` for isolated Cell test |

## Anti-Patterns

Forbidden unless justified with evidence:

- Launching without building first.
- Using `--load-extension` flag (Chrome 137+ blocks it completely — doesn't load).
- Using MCP `execute_cdp_command` to load extension (no Extensions domain).
- Killing Chrome with `Stop-Process` (no cleanup → clone leak).
- Editing `dist/` directly (edit `src/` then build).
- Spawning MCP while another MCP instance is still open on the same clone (profile lock).
- On Chrome 137+: using CDP `loadUnpacked` + close + MCP `spawn_browser` handoff (session-only — extension is lost; use packed .crx + External Extensions via `setup-cell-profile.py`).
- Pre-installing unpacked extensions by writing `extensions.settings` `location=4` entries into `Preferences` (Chrome 137+ strips them on launch).
- Copying `dist/` to another path (load from SSOT path).
- Guessing `chrome.storage` from page world (no `chrome.runtime` access).
- Using `caretRangeFromPoint` for shadow DOM (doesn't pierce).
- Declaring pass after one successful test. Repeat the action at least twice.
- Treating DOM text as user-visible behavior (check rendered rect, opacity, display).

## Evidence Capture Template

When a test fails, capture before changing anything:

```
Known facts:
- Build: <timestamp of dist/manifest.json>
- Clone: <cell-<uuid> path>
- Page: <URL + title>
- Target element: <selector + text + bounding rect>
- Trigger: <what was dispatched/clicked>
- Result: <totalEls count, error, null, etc.>

Guesses / theories:
-  ← test this
-  ← test this
```

Do not re-launch until the evidence board has more facts than guesses.

## Pause at Certainty

When you feel 90% confident the test passed, answer:

- What DOM evidence did I actually check?
- Did I repeat the trigger at least twice?
- Is the target element visible (`getBoundingClientRect` non-zero)?
- Could a stale build explain this result?
- Did I clean up the clone?

If the last answer is no, the test is not complete.

## SSOT Paths

| Key | Value |
|---|---|
| Cell ext (unpacked) | `<repo-root>\dist` (run build first) |
| Cell .crx (packed) | `<repo-root>\cell.crx` (run `setup-cell-profile.py --rebuild` after build) |
| Cell key | `<repo-root>\cell-key.pem` (auto-generated on first run) |
| uBlock ext | `<repo-root>\data\extension\uBOLite` |
| uBlock .crx | `<repo-root>\ublock.crx` |
| Master profile | `C:\stealth-mcp-browser-sessions\master` (clone source) |
| Clones | `C:\stealth-mcp-browser-sessions\sessions\cell-<uuid>` |
| Python | 3.11 via `uv run` (3.14 has nodriver encoding bug) |

## Setup Check

```
Test-Path "C:\stealth-mcp-browser-sessions\master\Local State","<repo-root>\dist\manifest.json","<repo-root>\data\extension\uBOLite\manifest.json"
```

- **True, True, True** → setup done, go to Step 1.
- **Any False** → read `SETUP.md`, run the corresponding step (one-time only).

## Example — Dictionary Popup on Subtitle Target

**Contract:**
```
Given: themoviebox.org video playing at t=190s, subtitle overlay visible, tokenize OFF
When: click word on subtitle target line
Then: #cell-universal-panel-host shadow children > 2 (popup opened)
```

**Step 1:** `npx vite build`
**Step 2:** `python .agents\skills\testing-extension-browser\script\setup-cell-profile.py --rebuild` → prints `CLONE_PATH=...`
**Step 3:** `mcp spawn_browser(user_data_dir="<CLONE_PATH>", headless=false)` → `state: "ready"`
**Step 4:** `mcp navigate(url="https://themoviebox.org/...")` → `mcp click_element selector=".art-control-playAndPause"` → `mcp execute_script: video.currentTime = 190`
**Step 5:** `mcp execute_script: dispatch mouseup composed:true at target span coords`
**Step 6:** `mcp execute_script: inspect #cell-universal-panel-host shadow → totalEls > 2 = PASS`
**Step 7:** `mcp close_instance` → `Remove-Item sessions\cell-* -Recurse -Force`

## Testing & Validation

Before declaring this skill complete on a browser test, run this matrix:

### Triggering tests

- [ ] Skill activates on: "Test this feature in the browser."
- [ ] Skill activates on: "Verify the fix works on a real page."
- [ ] Skill stays dormant for: "Run the unit tests."
- [ ] Skill stays dormant for: "Profile the page performance."

### Functional tests

- [ ] Run the test loop end-to-end on a real feature.
- [ ] Run the test loop on a shadow DOM feature (subtitle overlay).
- [ ] Run the test loop on a popup verification (element count check).
- [ ] The final verification uses DOM evidence, not "it looks right."

### Edge cases

- [ ] Build is stale → skill catches it at Step 1 guard.
- [ ] Profile locked → skill catches it at Step 3 guard.
- [ ] Target element empty → skill catches it at Step 5 guard.
- [ ] Popup didn't open → skill captures evidence before re-launching.

## Verification Checklist

After any browser test:

- [ ] Contract written with concrete DOM/count/text.
- [ ] Build completed before launch.
- [ ] `[PASS] Cell extension is running` printed.
- [ ] MCP `spawn_browser` returned `state: "ready"`.
- [ ] Page loaded + target element visible.
- [ ] Trigger fired with `dispatched: true`.
- [ ] Contract's "Then" clause passes with DOM evidence.
- [ ] Trigger repeated at least twice.
- [ ] Clone dir deleted after test.
- [ ] MCP instance closed.

## Timeboxing

If stuck in a loop for more than 15 minutes, escalate:

- Summarize the evidence board.
- List what passed and what failed.
- State the next experiment.
- Ask one focused question.

Do not spin. A stuck loop means the contract or setup is incomplete.

## Test sites

Text
- https://www.geeksforgeeks.org/machine-learning/machine-learning-algorithms/

Video
- https://themoviebox.xyz/movies/oh-boy-was-i-wrong-about-her-KZp0CGxDxI2?id=2281575019673174328&type=/movie/detail&detailSe=&detailEp=&lang=en
- https://kisskh.co/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851&page=0&pageSize=100
- https://moviepire.ru/watch/125988?s=1&e=2&me=10

Video (anti-automation — MUST use stealth-chrome-devtools)
- https://streamduck.site/ (detects DevTools/automation → reloads if driven by chrome-devtools)

## Final Note

A tester who defines the contract first beats a tester who clicks fast. The loop is the discipline. The clone is disposable. If you cannot write the contract, you cannot verify the feature. If you cannot verify it, you cannot ship it.

## Router boomerang

Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route. Debug failure? Invoke `/debugging-and-error-recovery`. Router protocol is in AGENTS.md (always-on).
