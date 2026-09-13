---
name: subtitle-player-research
description: Investigate a streaming page to discover how its subtitle list is produced. Use when researching subtitle support for a new site.
---

# Subtitle Player Research

## Purpose

Turn one supplied URL into:

```text
player topology → subtitle-list mechanism → verified entries → replay constraints
→ extension root cause → adapter solution → unresolved blockers
```

Research workflow, not implementation — do not modify `src/`. Never invent URLs, endpoints, tokens, selectors, or counts.

## Non-negotiable distinction

Report separately:

- **Player-side discovery:** the browser/player exposes a subtitle list.
- **Extension delivery:** Cell discovers, normalizes, replays, and stores every entry in background inventory.

DevTools/page-JS seeing a list is not extension support until the actual background inventory is checked.

## Evidence levels

| Level | Evidence | Claim allowed |
|---|---|---|
| E0 | hypothesis or URL clue | possible only |
| E1 | DOM, iframe `src`, UI, or network URL | mechanism observed |
| E2 | response/HTML/player-state payload parsed | player-side count/shape verified |
| E3 | direct URL status/content validated | entry fetchable with stated context |
| E4 | extension inventory has expected entries | end-to-end support verified |

Never label a site supported without E4. Otherwise write: `player-side verified; extension replay pending`.

## Workflow

```text
0. Scope → 1. Browser → 2. Topology → 3. Activate → 4. List source
→ 5. Validate entries → 6. Audit Cell delivery → 7. Root cause + adapter → 8. Report
```

| Step | Done when |
|---|---|
| 0. Scope | User-supplied URL preserved (never silently swap episode); test mode (player-side vs extension) recorded; detection path read (`subtitleDetector.ts`, `urls.ts`, `networkInterceptor.ts`, `offscreenFetch.ts`) |
| 1. Browser | Stealth MCP profile spawned; network body capture on before navigation; blockers recorded (ask once for the exact user action) |
| 2. Topology | Every frame's URL/origin/iframe-boundary/video/player-controls recorded; a parent can read `iframe.src` but not `contentDocument` — don't confuse them |
| 3. Activate | Clicked only observed controls; subtitle control opened; languages/variants/auto-captions recorded. No visible control ≠ no subtitles |
| 4. List source | One signal family identified with exact URL/initiator/frame/method/body source (signal table in detail ref) |
| 5. Validate entries | Every entry has label/lang/format/URL-type/flags/source/auth-context/status; `blob:` is player-local, `http(s)` only are download URLs; signed params preserved; UI-vs-API count discrepancy reported unresolved |
| 6. Cell delivery | `networkInterceptor.getSubtitles(tabId)` count checked; Network-panel request is never delivery evidence; E4 requires background inventory |
| 7. Root cause | Classified to one adapter family; adapter contract written; prefer registry of protocol adapters over site branches in `NetworkInterceptor` |
| 8. Report | Report template filled; verified/assumed/not-verified split |

→ Step detail, signal-family table, entry-validation rules, adapter contract, report template: `references/workflow-detail.md`
→ Cross-origin iframe delivery failures, play-on-demand players, in-player episode switches (with fix patterns): `references/delivery-failures.md`

## Anti-patterns (top offenders)

- DevTools list treated as extension list → check E4 inventory
- Guessing endpoint/token/selector → capture an actual request
- Stripping query tokens for dedup → keep fetch URL, separate identity key
- Executing arbitrary HTML script → parse one allow-listed variable
- `body unavailable` reported as "empty list"
- Assuming `<video>` exists on load — play-on-demand players create it on click
- Broadcasting `AUTO_LOAD_SUBTITLES` to all frames only — target the player frameId + broadcast fallback

## Verification

- [ ] Supplied URL used; profile/blockers/topology/cross-origin boundaries recorded
- [ ] Real list source captured or blocker stated; counts reconcile or discrepancy documented
- [ ] Player-side evidence not mislabeled as extension support; background inventory checked
- [ ] Root cause maps to one adapter family with a known ceiling
- [ ] Overlay + `AUTO_LOAD_SUBTITLES` verified in the correct frame/frameId; episode/provider switch clears old media + re-push
- [ ] No secrets or signed tokens committed to fixtures/logs

## Router boomerang

Task changes to implementation → `learning-and-apply` + `incremental-implementation` + `test-driven-development`; browser work → `testing-extension-browser`; runtime failure → `debugging-and-error-recovery`. Unsure → `using-agent-skills`.
