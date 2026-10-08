# Debug flow

## Where things live

- Profile: `C:\cell-browser-sessions\brave-debug`
  — logins and tabs survive restarts.
- Port: 9223 (`CELL_DEBUG_PORT` to change).
  Port 9222 belongs to another tool — never reuse.
- `CELL_DEBUG_PROFILE` starts a second browser.
- `BRAVE_EXE` points to a different Brave binary.

## Why the shortcuts

`ext-dist` and `ext-ublock` are junctions to the live
`dist/` and uBOLite folders. A space inside
`--load-extension` silently breaks launch: Brave opens
the pieces as junk tabs and loads nothing. Junctions
have no spaces, so this cannot happen.

Junk tabs like `http://ecosystem/...` mean it happened —
relaunch via the script. After `npm run build` the
extension is already fresh; reload at `brave://extensions`.

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

`browser.close()` over CDP shuts the whole browser —
end probes with `process.exit(0)` instead. Never
force-kill brave.exe; the debug window is the one with
`--user-data-dir=...brave-debug` in its command line.
To close it, connect over CDP and close gently.
