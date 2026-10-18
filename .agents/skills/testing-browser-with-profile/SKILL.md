---
name: testing-browser-with-profile
description: Brave debug browser for intermittent bugs - one isolated window per agent session. Includes the flow runner (script/run.mjs) — `youtube spamVerify` is the asserted regression gate for split-view changes.
---

# Brave debug

Each agent session owns its own Brave window. `session.ps1` resolves
your id (Devin session lock → `devin-<acp-pid>` fallback →
`Tihoka_AGENT_ID`); `launch-brave-debug.ps1` registers
`C:\Tihoka-browser-sessions\sessions\<id>.json` with your port/pid/profile,
and every script verifies the browser pid's command line matches your
profile+port before touching it — foreign windows are refused, never
shared. Override with `Tihoka_DEBUG_SESSION=<name>` for a stable named
profile that survives CLI restarts.

First launch reuses the newest orphan dir in `profiles/` (one no live
session claims) renamed to your id — logins/IndexedDB carry over and the
profile pool stays bounded. Pass `-New` to the launch script for a fresh
profile, only when the user asks for one explicitly (`/profile -new`).

Run the launch script **from the worktree you're working in** —
junctions are per-session (`ext-dist-<id>`), so your window installs
that worktree's `dist`. Registry stores the dist path; a worktree
switch triggers a graceful restart so the extension reinstalls fresh
(profile + IndexedDB survive — imported dictionaries persist).

1. `powershell script/launch-brave-debug.ps1` — prints your port/session
2. `node script/watch.mjs` — background, run first
3. `node script/seed-dicts.mjs` — installs the 3 tihoka dictionaries via
   the real RESOURCE_IMPORT_CHUNK pipeline (needs a production dist —
   a dev dist's SW never registers); `--status` lists jobs + resources
4. bug appears → read `tmp/debug-brave-<id>/console.jsonl`
5. `node script/probe.mjs --list` → `--match <url-substr> --eval "..." --shot n.png`
6. after `npm run build`: `probe.mjs --match <url-substr> --ext --reload`
   reloads extension SW then the page — prefer `--match` over `--page N`,
   /json target order is unstable

Watcher first — browsers forget old console.
Playwright `browser.close()` only disconnects — to actually shut the
window down send raw CDP `Browser.close`, and only for YOUR session's
port (see registry).

More: `references/debug-flow.md`

**Phone (Quetta/Android)**: real-device bench + zero-touch CRX updates via
`adb forward`/`reverse` + local `update_url` channel — see
`references/phone-quetta.md`. Repeat installs are ONE command:
`node script/phone-update.mjs --version <x.y.z.w>` (pack, serve,
adb reverse, update, verify). Use it whenever desktop numbers need
hardware truth (import perf, memory pressure, low-end devices).
