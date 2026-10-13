# Phone benching — LG V600 + Quetta + adb CDP

Real-device verification for the extension on Android. Verified working
2026-10-11 (Quetta Chrome/148, Android 10, Tihoka 0.1.10.x).

## Setup

```bash
ADB="C:/Users/The0cean/platform-tools-install/platform-tools/adb.exe"
$ADB devices                       # LMV600VM3eecbdeb
$ADB forward tcp:9444 localabstract:chrome_devtools_remote
# CDP endpoint: http://127.0.0.1:9444  (browser ws: /devtools/browser)
# Extension id: ifceodogdeeaacmdigljgmafnhkbfnia (manifest key → sha256 → a-p hex)
```

## Quetta CDP quirks (all verified)

- `Target.createTarget` → `Could not find TabModelList`. Never create
  tabs/pages via CDP — bootstrap an extension page by asking the service
  worker: `chrome.tabs.create({url: chrome.runtime.getURL('options.html'), active:false})`.
- **Per-target `webSocketDebuggerUrl` hangs** on this build — WS opens but
  `Runtime.evaluate` never answers. Use the **browser endpoint**
  `ws://…/devtools/browser` + `Target.attachToTarget {targetId, flatten:true}`
  + send commands with `sessionId`. This is reliable.
- `Target.getTargets` via browser ws can lag `/json/list`; retry the
  list when an expected target is missing.
- The MV3 service worker sleeps aggressively. Wake it by `Page.reload`
  on any `http(s)` tab (attach → `Page.reload`), then poll getTargets.
- A `chrome-extension://…/options.html` target created before a reinstall
  is a zombie — re-list targets after installs.

## Install / update paths

### First install (one time, needs taps)

1. Push the crx: `adb push tihoka-x.crx //sdcard/Download/` (double-slash —
   Git Bash mangles single `/sdcard`).
2. Foreground Quetta: `monkey -p net.quetta.browser -c android.intent.category.LAUNCHER 1`
   (its main activity is `com.google.android.apps.chrome.Main`,
   not `.MainActivity`).
3. Open the chrome://extensions target (`/json/activate/<id>` or CDP).
4. Tap "(from .zip/.crx/.user.js)" → DocumentsUI picker → Downloads → file.
   Get exact bounds from `uiautomator dump` + pull `/sdcard/ui*.xml`;
   `screencap -p` PNG is already physical px (1080×2460).

### Zero-touch updates (repeat installs — USE THIS)

**Fixed step — always use the script.** After `npm run build`:

```bash
node .agents/skills/testing-browser-with-profile/script/phone-update.mjs --version 0.1.10.2
```

The script does the whole cycle: bumps `version` (must exceed installed —
always pick a NEW 4-part value) + writes `update_url` into `dist/manifest.json`
temporarily, packs `tmp/perf-campaign/update-serve/tihoka.crx` with
`tihoka-key.pem`, generates `updates.xml`, serves the dir on `127.0.0.1:8877`,
runs `adb reverse`, triggers `runtime.requestUpdateCheck()` →
`runtime.reload()`, and verifies `getManifest().version` — exits non-zero on
any failure. Options: `--cdp`, `--port`, `--adb`, `--key`, `--dist`,
`--timeout-ms`.

How it works (for reference, if scripting manually): `adb reverse
tcp:8877 tcp:8877` maps phone localhost → this machine, so the installed
build's `update_url: http://127.0.0.1:8877/updates.xml` resolves to the local
server — HTTP on localhost is accepted (Google's own
extension-update-testing-tool works this way). Verified mechanics:
`requestUpdateCheck()` → `update_available`, then Chrome downloads + stages
in the background and fires `runtime.onUpdateAvailable` when ready — call
`runtime.reload()` only AFTER that event (reloading early keeps the old
version; the staged update still applies on the next natural SW restart).
Do the listener+check+stage+reload in ONE `Runtime.evaluate` — the MV3
service worker dies within ~30s and kills pending evals; the script's
`evalExt` retries on a fresh target (try EVERY ext target listed —
`/json/list` keeps dead entries; ping the SW awake via
`offscreen → chrome.runtime.sendMessage` or an http `Page.reload`; attach
via browser endpoint + `flatten:true` — never per-target ws; offscreen
'other' targets lack `runtime.getManifest`/`requestUpdateCheck`).

## Bench scripts (tmp/perf-campaign/)

- `import-bench.mjs --cdp http://127.0.0.1:9444 --raw` — full delete +
  chunked upload + parse + SW-probe timing via the real
  `RESOURCE_IMPORT_CHUNK`/`RESOURCE_DELETE`/`JOB_LIST` pipeline. gzip on by
  default; `--plain` for pre-gzip builds. `--only <substr>` (repeatable)
  filters **both** delete and import — never deletes a dict it cannot
  re-import from the FILES list / `--extra <repo path>` entries.
  `--skip-delete` for pure import timing. Output → `phone-import.json`.
- `phone-eval.mjs` — one-off: pipe a JS expression or a bare
  `MESSAGE_TYPE` + payload-JSON arg; same browser-endpoint bootstrap.
- Always verify after: `RESOURCE_LIST` word counts; a parse that returns
  in <1s on a multi-MB dict is a dedupe/reconcile artifact, not a result —
  treat as invalid until a lookup proves content.

## Data safety

- The bench deletes installed dictionaries before importing — only run it
  when every resource it can match is backed by a file in FILES/`--extra`
  from the repo. `--only` applies to deletion too (fixed 2026-10-11 —
  earlier it deleted everything regardless).
- There is no `JOB_CANCEL` handler; a started delete/import job runs to
  completion. Killing the client does not kill the job — let it finish,
  then re-import to restore.
