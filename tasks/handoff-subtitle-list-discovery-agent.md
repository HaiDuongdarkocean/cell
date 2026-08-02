# Autonomous Handoff Prompt — Generic Subtitle List Discovery E4

You are the implementation agent for the Cell Chrome extension. Work autonomously from this prompt.
Do not ask the user questions during implementation. If something is ambiguous, inspect the repository,
existing tests, rules, spec, and live behavior; compare at least three viable options against correctness,
performance, extensibility, maintainability, and user experience; choose the best option; record the
decision and continue.

## Mission

Implement the generic subtitle-list discovery system described by:

- `docs/specs/subtitle-list-discovery-e2e.md`
- `tasks/plan-subtitle-list-discovery-e2e.md`
- `tasks/todo-subtitle-list-discovery-e2e.md`
- `docs/player-support.md`

The release target is E4 for all nine audited site families:

```text
player catalog = normalized candidates = replayable sources
                = background inventory = subtitle panel
```

Do not call a site supported from DevTools/PowerShell-only evidence. A site is E4 only when the real
extension background inventory and panel contain the expected current-session count and the URLs can be
replayed/downloaded with their required context.

## Autonomous operating rules

1. Never ask the user for a design choice, missing selector, endpoint, token, or next step.
2. Resolve uncertainty by reading code/tests/docs and running the smallest safe experiment.
3. For every non-trivial decision, write a short decision table with three options and select one using:
   correctness > performance > extensibility > maintainability > user experience.
4. Prefer existing code, browser-native APIs, and installed dependencies. Do not add a dependency unless
   the codebase cannot solve the problem and bundle impact is checked.
5. Do not modify unrelated work. Before editing, run `git status --short` and inspect `git diff`.
6. Do not delete files, rewrite history, commit, or push unless explicitly authorized elsewhere.
7. Never log or commit cookies, authorization headers, signed URLs, tokens, decoder keys, or secrets.
8. Never bypass CAPTCHA, authentication, paywalls, or anti-bot protections.
9. Never execute arbitrary third-party JavaScript as a parser.
10. If an external site cannot satisfy E4, record an evidence-backed release blocker and continue with
    the remaining tasks; never fabricate a pass.
11. Do not pause after each task for human approval. Complete the ordered plan autonomously.
12. At the end, provide a final report; do not ask the user what to do next.

## Required context loading before code

Read in this order:

1. `AGENTS.md`
2. `docs/0-wiki.md`
3. `docs/1-share-language.md`
4. `docs/2-architechture-system.md`
5. `docs/specs/subtitle-list-discovery-e2e.md`
6. `tasks/plan-subtitle-list-discovery-e2e.md`
7. `tasks/todo-subtitle-list-discovery-e2e.md`
8. `docs/player-support.md`
9. `package.json` and `public/manifest.json`
10. Relevant source/tests for the current task only.

Before writing TypeScript or changing detection/messaging/data/build/test code, run the repository's
`learning-and-apply` knowledge lookup for the relevant categories (`data`, `detection`, `messaging`,
`state`, `async`, `testing`, `build`). Apply known good patterns before editing.

Before changing source, read the complete target files and at least one neighboring test/example. Do not
trust generated files, old architecture trees, or stale docs over current source/tests.

## Mandatory architecture

Use a generic protocol-oriented pipeline, not host branches in `NetworkInterceptor`:

```text
observation signal
  → adapter registry
  → acquire body/state
  → validate untrusted input
  → parse pure data
  → normalize candidate
  → resolve relative/metadata source
  → preserve replay context
  → O(1)-average identity dedup
  → background inventory
  → panel/download delivery
```

Use these typed concepts, refining them only when existing code proves a better contract:

- `SubtitleSignal`: network response body, iframe source, document HTML, player state, HLS playlist.
- `SubtitleDiscoveryAdapter`: `id`, priority, match, discover/parse/resolve behavior.
- `SubtitleCandidate`: label, language, explicit format, source kind, status, identity, tab/frame,
  initiator, and replay context.
- Candidate states: `ready`, `unresolved`, `expired`, `rejected`.
- Source kinds: direct URL, relative URL, typed metadata handle.

Keep `DetectedSubtitle` compatibility. Prefer a metadata-preserving ingestion method over abusing
`handleRequest({ trustAsSubtitle: true })` when URL inference would lose language or format.

Use Zod at external boundaries. Use `unknown`, never explicit `any`. Keep pure parsers separate from
network/DOM side effects.

## Ordered execution plan

### T1 — Candidate/entity contract and sanitized fixtures

Implement the typed candidate states, signal-independent source model, replay context, identity key,
and sanitized fixtures for all nine families.

Verify:

- focused schema/fixture tests;
- `npm run typecheck`;
- no `any`;
- existing `DetectedSubtitle` consumers compile;
- fresh `subagent_general` verifier using the T1 prompt in the plan.

Do not include real signed URLs or tokens in fixtures.

### T2 — Secure observation signal schemas

Add validated message payloads for response bodies, iframe sources, HTML, player state, and HLS bodies.
Include nonce, origin, tab, frame, initiator, and payload-size validation.

Verify malformed messages, wrong origin, wrong nonce, oversized bodies, missing context, unit tests,
typecheck, and a fresh `subagent_general` verifier.

### T3A — MV3 MAIN-world/all-frames preflight

Before writing new bridge code, inspect and verify the existing manifest:

- `fetchInterceptor.iife.ts` is `world: MAIN`;
- `all_frames: true`;
- `match_origin_as_fallback: true`;
- `<all_urls>` matches/host permissions;
- existing YouTube/iQIYI/Netflix bridges remain unaffected.

Run `npm run build` and a headed `cell-profile` fixture with a top page and cross-origin child frame.
Record Chrome results and any Edge/Brave result available. Do not change manifest permissions without
an evidence-backed need; if a permission change is unavoidable, choose the minimum and document it.
Use a fresh `subagent_general` verifier. This task must pass before bridge implementation.

### T3 — Frame-safe MAIN-world and isolated observation bridge

Implement allow-listed fetch/XHR body and player-state observation relay:

```text
MAIN world → nonce/origin checked isolated content script → background
```

Preserve actual `frameId`, initiator, and owning origin. Reject unrelated messages. Do not execute body
text as code. Keep existing main-world integrations green.

Verify integration fixture, wrong-origin/nonce/oversized cases, browser smoke, typecheck, integration
tests, and build. Use a fresh `subagent_general` verifier.

### T4 — Adapter registry, replay context, and bounded pipeline

Implement registry dispatch, validation, pure parsing boundary, normalization, identity dedup, bounded
replay, and metadata-preserving inventory ingestion. Keep existing generic URL/native-track/Stremio
flows unchanged.

Verify synthetic signal-to-inventory flow, duplicate/reload idempotence, signed URL preservation,
metadata/unresolved behavior, complexity review, unit/integration tests, typecheck, build, and a fresh
`subagent_general` architecture verifier.

### T5 — JSON-array adapters: cinesrc and kisskh

Support:

- cinesrc: `subs.* /search?id=...`, 100 API entries, 98 SRT + 2 SSA;
- kisskh: `/api/Sub/<epId>?kkey=...`, 6 direct SRT entries.

Preserve explicit language/format, exact signed query, initiator, frame, and replay context. Reject
malformed entries. Do not infer all formats as VTT.

Verify parser fixtures, replay through extension context, background inventory counts, panel counts,
typecheck, build, and fresh `subagent_general` verifier.

### T6 — JSON-object adapters: lookmovie and broodingmovies

Support:

- lookmovie: 111 catalog entries; 87 direct VTT plus 24 OpenSubtitles metadata arrays;
- broodingmovies: 42 `default_subs` entries with required context.

For lookmovie, do not silently drop or fabricate the 24 metadata entries. Implement and verify a
legitimate resolver; otherwise retain them as unresolved and record the explicit E4 release blocker.
Verify extension-context Referer/Origin replay, not PowerShell-only behavior.

Verify counts, unresolved states, replay, inventory/panel, typecheck, build, and fresh `subagent_general`.

### T7 — iframe-hash and HTML-variable adapters: lunastream and MyAsianTV

Support:

- lunastream: parse the observed parent-owned iframe `src` `subs=[JSON]`, 33 direct URLs;
- MyAsianTV/kisscloud: parse allow-listed `playerjsSubtitle`, 4 direct WebVTT URLs.

Do not access cross-origin child DOM directly. Resolve relative URLs against the owning frame origin.
Preserve the exact kisscloud Referer and verify replay through extension path.

Verify malformed hash/HTML inputs, no script execution, live browser counts, inventory/panel, typecheck,
build, and fresh `subagent_general` verifier.

### T8 — Deep player-state adapter: noxx

In the owning `cloudorchestranova.com/prorcp` frame, read only allow-listed `window.the_subtitles` via
MAIN-world bridge. Resolve 43 `[label]/relative .vtt` entries against frame origin. Preserve frame,
initiator, token/referrer context, and send only validated candidates.

Verify bridge security cases, headed `cell-profile` noxx test, 43/43 background/panel entries, typecheck,
build, and fresh `subagent_general` verifier.

### T9 — Encrypted adapter: moviepire/videasy

Isolate the current custom XOR/PRNG decoder and seed acquisition. Validate encrypted payload, reject
wrong seed/tampering, parse the decrypted JSON, and produce 85 direct VTT candidates. Do not spread
crypto/decode logic through the generic kernel. Never log ciphertext, seed, or auth values.

Verify deterministic vectors, tamper/wrong-seed tests, live 85/85 replay, background/panel counts,
typecheck, build, and fresh `subagent_general` verifier.

### T10A — Onflix server/HLS catalog pre-audit

Before implementing the adapter, use headed `cell-profile` on the exact supplied Onflix page to
enumerate every supported server (`SN`, `NC`, `PA`, `OP` or the current observed set). Capture every
player iframe/m3u8/VTT source, inspect master/media playlists for `EXT-X-MEDIA:TYPE=SUBTITLES`, and
produce a concrete per-server expected catalog/count and replay context.

Do not treat the previous SN-only two VTT observation as a complete catalog. If a server is blocked,
record it as a release blocker rather than zero subtitles. Use a fresh `subagent_general` research
verifier. This task may update sanitized evidence/docs but does not implement the adapter.

### T10 — HLS and server-variant adapter: onflix

Implement HLS subtitle media parsing, relative URL resolution, direct VTT fallback, server-specific
replay context, and delivery against the T10A matrix. Pass only when every T10A entry is replayable and
in the background/panel.

Verify HLS fixtures with/without subtitle media, all server counts, headed browser, typecheck, build,
and fresh `subagent_general` verifier.

### T11 — Inventory/panel integration and nine-site E4 matrix

Verify all nine sites in a real `cell-profile` browser session:

```text
expected catalog → normalized ready → replayable → background inventory → panel
```

Check SPA navigation, iframe reload, duplicate requests, signed URL changes, unresolved handling, and
existing Stremio/native-track/generic URL regression. Any mismatch is FAIL; do not downgrade silently.
Run unit/integration/build/E2E and a fresh `subagent_general` final verifier with the nine-site matrix.

### T12 — Architecture and documentation closeout

Update current evidence/counts and architecture tree/function index; update wiki index; link spec/plan/
tasks/evidence. Remove or label stale claims. Run Markdown/link review, `git diff --check`, and a
fresh `subagent_general` documentation verifier.

## Per-task verifier protocol

After each task, launch a fresh `subagent_general` with no prior conversation context. The verifier must:

1. Read the relevant task section, changed files, tests, and existing rules.
2. Run the task's listed tests/build commands.
3. Inspect the diff for security, type, architecture, and regression issues.
4. Use headed `cell-profile` browser verification when the task is browser-facing.
5. Compare observed count to expected count and record `ready`, `unresolved`, `replayable`, background,
   and panel counts.
6. Never edit files.
7. Return exactly `PASS` or `FAIL`, evidence paths/commands, and actionable failures.

A task is complete only after main checks and verifier PASS. On FAIL, fix the task, rerun checks, and
rerun a fresh verifier. Do not ask the user.

## Mandatory quality gates after source changes

For every modified `.ts`, `.tsx`, `.css`, or `src` `.json` file:

```text
npm run typecheck
npm run test:unit
npm run build
```

Use integration/E2E/browser commands whenever the task says so. Update architecture docs when `src/`
structure/function dependencies change. Do not commit or push.

## Self-directed decision rubric

When multiple approaches are possible, write a decision table in the task notes:

| Option | Correctness | Performance | Extensibility | Maintainability | UX | Decision |
|---|---|---|---|---|---|---|
| A | ... | ... | ... | ... | ... | ... |
| B | ... | ... | ... | ... | ... | ... |
| C | ... | ... | ... | ... | ... | ... |

Choose the option with the best weighted outcome, where correctness is the hard gate. Prefer:

- typed registry over host conditionals;
- page/frame observation over guessing response bodies;
- captured signed URLs over reconstructing tokens;
- incremental parsing + Map dedup over full rescans;
- explicit unresolved blockers over fabricated support;
- existing dependencies/APIs over new packages.

## Final output required from the implementation agent

Report:

1. Tasks completed and verifier PASS evidence.
2. Files changed and why.
3. Nine-site E4 matrix: expected, ready, replayable, background, panel, status.
4. Decisions made with the three-option comparison.
5. Tests/build/browser commands and results.
6. Remaining explicit blockers, if any.
7. No user questions. State the autonomous next action only if more implementation remains.
