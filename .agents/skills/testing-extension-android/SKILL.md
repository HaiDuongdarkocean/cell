---
name: testing-extension-android
description: Install a packed .crx into Quetta (or any Chromium Android browser) over ADB and verify it via CDP. Use for on-device extension install/testing. Not for desktop Chrome testing (→ testing-extension-browser).
---

# Testing Extension on Android

## Mechanism (proven — don't try alternatives)

- The ONLY automatable install path: `adb reverse` + serve `.crx` over HTTP → CDP `Page.navigate` a browser tab to `http://localhost:<port>/<name>.crx` → browser downloads it → tap the two dialogs via `uiautomator dump` + `input tap` on `…:id/positive_button` ("Download anyway", then `OK` on `Add "<ExtName>"?`).
- NOT possible: `am start` VIEW intent (no .crx handler), CDP `Extensions.loadUnpacked` (absent on Android), SAF picker (fragile).
- Devtools socket: forward each `chrome_devtools_remote*` from `/proc/net/unix`, keep the one whose `/json/version` `Android-Package` == target pkg — suffix/PID changes on restart, bare name may be another browser.
- Verify install: `Runtime.evaluate` `chrome.runtime.getManifest().version` on any `chrome-extension://<id>/` target (prefer `service_worker`; stale page targets hang — always timeout ws calls).
- Reinstall wipes extension storage — seed preconditions via SW target + `Page.reload` before smoke.
- Tools: `adb` (platform-tools — resolve env `ADB` → `~/platform-tools-install/` → PATH), `crx3`, `ws`; USB debugging + RSA authorized (`adb devices` ends `device`); browser running (`monkey -p <pkg> -c android.intent.category.LAUNCHER 1`).

## Per-project config

- `EXT_ID` (manifest `"key"`-derived), `EXT_NAME` (must match dialog text), `BROWSER_PKG`, `CRX_NAME`, signing `.pem`, ports.

## Pitfalls

- Node native `WebSocket` hangs on these ws URLs → use `ws` package.
- `node_modules/.bin/*.cmd` can't `spawnSync` on Windows Node ≥20 → spawn `node <pkg>/bin/<cli>.js`.
- Git Bash mangles `/sdcard/…` → pass args via `execFileSync` array.
- `uiautomator dump` → `/sdcard/` (no /tmp); read via `adb shell cat`, no pull.
- `connectOverCDP().close()` kills the real browser → `process.exit(0)` to keep session.
- Playwright only exposes default-context pages on Android → extension targets need raw ws on `webSocketDebuggerUrl`.

## Reference

- `script/ship-mobile.mjs` — full working impl (copy + adjust CONFIG). Setup-from-scratch: `references/setup.md`.
