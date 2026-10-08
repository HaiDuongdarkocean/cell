---
name: testing-browser-with-profile
description: Brave debug browser for intermittent bugs.
---

# Brave debug

1. `powershell script/launch-brave-debug.ps1`
2. `node script/watch.mjs` — background, run first
3. bug appears → read `tmp/debug-brave/console.jsonl`
4. `node script/probe.mjs --list` → `--match <url-substr> --eval "..." --shot n.png`
5. after `npm run build`: `probe.mjs --match <url-substr> --ext --reload`
   reloads extension SW then the page — prefer `--match` over `--page N`,
   /json target order is unstable

Watcher first — browsers forget old console.
Never `browser.close()` over CDP — it kills Brave.

More: `references/debug-flow.md`
