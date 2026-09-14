# Testing Extension Browser — failure patterns, traps, paths

## Common failure patterns

| Symptom | Likely cause | Falsify by |
|---|---|---|
| `[PASS]` but feature not found | Stale `dist/` — built before code change | Rebuild + `setup-cell-profile.py --rebuild` |
| No Cell in `chrome://extensions` | External Extensions JSON missing or .crx path wrong | Re-run setup; check `<clone>/Default/External Extensions/<id>.json` |
| `Pack failed` | `openssl` not in PATH or `dist/` missing | `npm run build`; verify `openssl version` |
| `extensions.settings` empty after launch | Chrome strips hand-written `location=4` unpacked entries | Use .crx + External Extensions (the setup script) |
| Spawn fails (profile locked) | Previous Playwright context didn't close | `context.close()` old context, wait 3s, retry |
| Marker not found | Content script didn't inject | Check `fetchPatched: true` via `page.evaluate` |
| `page.evaluate` returns null | Async code — Playwright serializes the result; promises are awaited, but page functions must return | Sync IIFE, or return a Promise from `page.evaluate` |
| `chrome.storage` undefined | Page world has no `chrome.runtime` | Inspect DOM attributes instead |
| Click on shadow element no effect | Event not `composed: true` | Add `composed: true` to MouseEvent |
| `caretRangeFromPoint` non-text | Doesn't pierce shadow DOM | `shadowRoot.elementFromPoint` |
| Target text empty | Cue not active at current time | Seek to a different timestamp |
| Popup `totalEls === 2` | Feature didn't trigger or failed | Re-check trigger + capture DOM |
| Clone leak after hard kill | `Stop-Process` skips cleanup | `Remove-Item` sessions manually |
| Python encoding error | Wrong Python version | `uv run --python 3.11` |

## Extension test traps

| Trap | Why | Falsify by |
|---|---|---|
| Stale build | Script loads `dist/`, not `src/` | Compare `dist/manifest.json` timestamp vs last edit |
| Profile lock | Two processes on same clone | One Chrome per clone at a time |
| Shadow DOM invisible to `caretRangeFromPoint` | API doesn't pierce shadow | `shadowRoot.elementFromPoint` |
| Autoplay blocked | Browser policy | Click play first, then seek |
| Event retargeting | Shadow events retarget to host | `composed: true` + dispatch on `document` |
| Content script not injected | Page reloaded before script ready | `--no-reload` if needed |
| uBlock blocks test resource | Ad/resource filtered | `--no-ublock` for isolated Cell test |

## Full anti-patterns list

- Launching without building first
- `--load-extension` (Chrome 137+ blocks it completely)
- `execute_cdp_command` to load extension (no Extensions CDP domain)
- `Stop-Process` / `taskkill` on Chrome (no cleanup → clone leak)
- Editing `dist/` directly (edit `src/` then build)
- Second Playwright context on the same clone (profile lock)
- CDP `loadUnpacked` + close + spawn handoff (session-only — extension lost)
- Pre-installing unpacked via Preferences `location=4` (stripped on launch)
- Copying `dist/` elsewhere (load from the SSOT path)
- Guessing `chrome.storage` from page world
- `caretRangeFromPoint` for shadow DOM
- Declaring pass after one test — repeat ≥2×
- DOM text as user-visible behavior — check rendered rect, opacity, display

## SSOT paths

| Key | Value |
|---|---|
| Cell ext (unpacked) | `<repo-root>\dist` (build first) |
| Cell .crx | `<repo-root>\cell.crx` (`setup-cell-profile.py --rebuild` after build) |
| Cell key | `<repo-root>\cell-key.pem` (auto-generated first run) |
| uBlock ext | `<repo-root>\data\extension\uBOLite` |
| uBlock .crx | `<repo-root>\ublock.crx` |
| Master profile | `C:\cell-browser-sessions\master` |
| Clones | `C:\cell-browser-sessions\sessions\cell-<uuid>` |
| Python | 3.11+ (chỉ dùng cho `setup-cell-profile.py` pack .crx) |

## Setup check

```
Test-Path "C:\cell-browser-sessions\master\Local State","<repo-root>\dist\manifest.json","<repo-root>\data\extension\uBOLite\manifest.json"
```

All true → go to Step 1. Any false → read `SETUP.md`, run the one-time step.

## Timeboxing

Stuck >15 minutes → escalate: summarize the evidence board, list what passed/failed, state the next experiment, ask one focused question. A stuck loop means the contract or setup is incomplete.

## Test sites

- Text: https://www.geeksforgeeks.org/machine-learning/machine-learning-algorithms/
- Video: (see original list in git history / SETUP.md if present)
