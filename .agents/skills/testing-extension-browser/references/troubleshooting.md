# Testing Extension Browser — failure patterns & paths

## Failure patterns (symptom → cause → falsify)

| Symptom | Likely cause | Falsify by |
|---|---|---|
| `[PASS]` but feature missing | Stale `dist/` — built before the change | Rebuild + `setup-Tihoka-profile.py --rebuild` |
| Tihoka absent in `chrome://extensions` | External Extensions JSON missing/.crx path wrong | Re-run setup; check `<clone>/Default/External Extensions/<id>.json` |
| `Pack failed` | `openssl` missing or no `dist/` | `npm run build`; `openssl version` |
| `extensions.settings` empty | Chrome strips hand-written `location=4` unpacked entries | Use .crx + External Extensions (the setup script) |
| Spawn fails (profile locked) | Old Playwright context not closed | `context.close()`, wait 3s, retry — one Chrome per clone |
| Marker not found | Content script didn't inject | `fetchPatched: true` via `page.evaluate` |
| `page.evaluate` returns null | Page function didn't return (async) | Sync IIFE, or return the Promise |
| `chrome.storage` undefined | Page world has no `chrome.runtime` | Inspect DOM attributes instead |
| Shadow click no effect | Event not `composed: true` | `MouseEvent(..., { composed: true })` on `document` |
| `caretRangeFromPoint` non-text | Doesn't pierce shadow DOM | `shadowRoot.elementFromPoint` |
| Target text empty | Cue not active at current time | Seek to a different timestamp |
| Popup `totalEls === 2` | Feature didn't trigger or failed | Re-check trigger + capture DOM |
| Clone leak after hard kill | `Stop-Process`/`taskkill` skips `context.close()` | `Remove-Item` sessions manually — never hard-kill Chrome |
| Python encoding error | Wrong Python version | `uv run --python 3.11` |
| uBlock blocks test resource | Ad/resource filtered | `--no-ublock` for isolated Tihoka test |

## SSOT paths

| Key | Value |
|---|---|
| Tihoka ext (unpacked) | `<repo-root>\dist` (build first) |
| Tihoka .crx / key | `<repo-root>\Tihoka.crx` / `Tihoka-key.pem` (auto-generated once) |
| uBlock ext / .crx | `<repo-root>\data\extension\uBOLite` / `ublock.crx` |
| Master profile | `C:\Tihoka-browser-sessions\master` |
| Clones | `C:\Tihoka-browser-sessions\sessions\Tihoka-<uuid>` |
| Python | 3.11+ (only for `setup-Tihoka-profile.py`) |

## Setup check

```
Test-Path "C:\Tihoka-browser-sessions\master\Local State","<repo-root>\dist\manifest.json","<repo-root>\data\extension\uBOLite\manifest.json"
```

All true → Step 1. Any false → `SETUP.md` one-time step.

## Timeboxing

Stuck >15 min → escalate: evidence board, what passed/failed, next experiment, one focused question. A stuck loop means the contract or setup is incomplete.

## Test sites

- Text: https://www.geeksforgeeks.org/machine-learning/machine-learning-algorithms/
- Video: see git history / `SETUP.md`
