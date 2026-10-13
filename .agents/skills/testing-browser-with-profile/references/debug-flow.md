# Debug flow

## Where things live

- Session id: `script/session.ps1` prints it.
  Order: `Tihoka_DEBUG_SESSION` env → walk ancestors to the
  `devin.exe acp` process → Restart Manager finds which
  `~\AppData\Roaming\devin\cli\session_locks\<id>.lock` that pid
  holds → fallback `devin-<acp-pid>` → `Tihoka_AGENT_ID` → refuse.
  No id, no browser — an agent can never land on another's window.
- Registry: `C:\Tihoka-browser-sessions\sessions\<id>.json`
  `{port, pid, profile, out}`. Stale entries (pid dead or
  cmdline mismatch) are swept on next launch.
- Profile: `C:\Tihoka-browser-sessions\profiles\<id>` — seeded once
  from the `brave-debug` template (logins/cookies carry over,
  caches excluded). Want a profile that survives CLI restarts?
  `export Tihoka_DEBUG_SESSION=main-debug` first.
- Port: first free in 9330-9429, skipped if listening or claimed
  by another live session. `Tihoka_DEBUG_PORT` overrides.
  Port 9222 belongs to another tool — never reuse.
- Logs/screens: `tmp/debug-brave-<id>/`.
- `BRAVE_EXE` points to a different Brave binary.

## Why the shortcuts

`ext-dist-<id>` and `ext-ublock-<id>` are per-session
junctions to the live `dist/` and uBOLite folders of the
worktree the script ran from. A space inside
`--load-extension` silently breaks launch: Brave opens
the pieces as junk tabs and loads nothing. Junctions
have no spaces, so this cannot happen.

Junk tabs like `http://ecosystem/...` mean it happened —
relaunch via the script. After `npm run build` the
extension is already fresh; reload at `brave://extensions`.

uBOLite is optional — a worktree without
`data/extension/uBOLite` (it's gitignored) launches with
the Tihoka extension only.

## Switching worktrees

The registry records which `dist` the running window
installed. Run `launch-brave-debug.ps1` from another
worktree and it detects the mismatch, sends CDP
`Browser.close`, waits for exit, then relaunches on the
same port with new junctions — a true fresh install
(`chrome.runtime.reload()` is NOT enough: it re-reads the
old source path, and `--load-extension` args are baked
into the running process). Profile + IndexedDB survive,
so seeded dictionaries stay. Verified marker:
`chrome.runtime.getManifest()` on an options page shows
the worktree build's name/version.

## Seeding dictionaries

`seed-dicts.mjs` uploads `data/resource/en/dictionary/tihoka format/`
(COCA-60000.freq + Macmillan-2Ed + Macmillan-EnEn) through the real
`RESOURCE_IMPORT_CHUNK` message pipeline — same result as dropping the
files on the settings dropzone. Custom paths as args; `--status` prints
jobs + installed resources. It re-acquires an extension page per message
(the options tab can die mid-upload on renderer crashes) and retries each
file up to 3× with fresh jobIds — an "interrupted-upload-stall" job row
can coexist with a fully imported resource, so verify with
`RESOURCE_FIND`, not the job list.

Requires a **production `dist/`** (`npm run build`). A dev-mode dist's
service-worker-loader points at `localhost:5173` — no vite server, no SW,
every sendMessage returns "no receiving end". Fix: rebuild + close the
browser via CDP `Browser.close` (Playwright `browser.close()` only
disconnects) + relaunch.

## The watcher

`watch.mjs` writes every console message, error and
network failure — from tabs and the extension alike —
into `console.jsonl`, one line each. Browsers forget
old console output, so it must run before the bug.
If it dies, restart it; only lines in the gap were lost.

## When the bug appears

1. Read `console.jsonl` around that minute.
2. `probe.mjs --list` → `--match <url-substr> --eval "..."`
   or `--shot name.png` for a screenshot.
   `/json` target order shifts when tabs open/close —
   `--match` (URL substring) beats `--page N`.
3. Patch the live page with `--eval` first; if the
   bug vanishes you found the cause — then edit source.

## After a rebuild

`probe.mjs --match <url-substr> --ext --reload` —
calls `chrome.runtime.reload()` on every extension
service worker, waits 1.5s, then reloads the matched
page so fresh content scripts re-inject. `--ext` or
`--reload` alone work too.

## Safety

Playwright `browser.close()` over connectOverCDP only
detaches — the window stays up, so end probes with
`process.exit(0)` and don't expect close() to clean up.
To shut your window on purpose, send raw CDP
`Browser.close` on your session's port. Never
force-kill brave.exe; your debug window is the one whose
command line has `--user-data-dir=...profiles\<id>` and
`--remote-debugging-port=<port>` from your registry file —
other entries belong to other sessions, leave them alone.
To close yours, connect over CDP and close gently.
