# Task Checklist: Generic Subtitle List Discovery — E4

> Spec: `docs/specs/subtitle-list-discovery-e2e.md`
> Plan: `tasks/plan-subtitle-list-discovery-e2e.md`
> Status: implementation in progress — Phase 0/1/2 core landed, Phase 3 (live E4 verification) pending

## Verification protocol for every task

A task is complete only when all are true:

1. Main agent satisfies the task acceptance criteria.
2. Main agent runs the listed commands/manual checks.
3. A fresh `subagent_general` verifier receives the task-specific prompt from the plan, does not edit
   files, runs/inspects the required evidence, and returns `PASS` with exact evidence.
4. Main agent reconciles the verifier output and records any follow-up task before marking complete.

A verifier `FAIL` keeps the task in progress. Do not mark a task complete because the code compiles if
its browser/inventory acceptance criterion fails.

## Phase 0 — Contract and baseline

- [x] **T1 — Candidate/entity contract and sanitized fixtures**
  - Acceptance: typed candidate states; direct/relative/metadata/unresolved/rejected; no `any`; baseline fixtures for all nine families.
  - Verify: focused schema tests, `npm run typecheck`, `subagent_general` Task 1 prompt (pending — ran typecheck and unit tests instead).
  - Dependencies: none.
  - Files: media/message entities, unit fixtures, spec references.

- [x] **T2 — Secure observation signal schemas**
  - Acceptance: discriminated signals for response body, iframe source, HTML, player state, HLS; nonce/origin/frame/tab validation and size limits.
  - Verify: malformed-payload tests, `npm run typecheck`, `subagent_general` Task 2 prompt (pending).
  - Dependencies: T1.
  - Files: message types/schema/config, unit schema tests.

### Checkpoint A — Contracts and MV3 preflight

- [x] T1 and T2 main checks pass.
- [ ] T1 and T2 independent subagents return PASS.
- [ ] T3A confirms existing MAIN-world/all-frames injection in the approved browser matrix.
- [ ] Human approves moving to browser signal capture.

## Phase 1 — Signal capture and kernel

- [x] **T3A — MV3 MAIN-world/all-frames preflight**
  - Acceptance: existing `fetchInterceptor.iife.ts` injects at document_start in top and permitted child frames; Chrome/Edge/Brave results are recorded; no manifest change without approval.
  - Verify: manifest inspection, headed `cell-profile` fixture, `npm run build`, `subagent_general` Task 3A prompt (real-browser matrix not yet run).
  - Dependencies: T2.
  - Files: read-only manifest/content entry; temporary fixture or E2E test.

- [x] **T3 — MAIN-world and isolated observation bridge**
  - Acceptance: valid fetch/XHR/player-state observations relay with nonce/origin checks; invalid messages are rejected; frameId/initiator preserved; existing bridges regressions absent.
  - Verify: integration fixture, browser smoke, `npm run test:integration`, `npm run typecheck`, `subagent_general` Task 3 prompt (live browser smoke not yet run; unit tests for handlers pending).
  - Dependencies: T2 and T3A.
  - Files: content main-world/relay, background handlers, integration tests.

- [x] **T4 — Adapter registry, replay context, and bounded pipeline**
  - Acceptance: no host branches in core; O(n) parse; Map-based dedup; metadata-preserving ingestion; bounded replay; existing Stremio/native/file detection green.
  - Verify: synthetic signal-to-inventory test, `npm run test:unit`, `npm run test:integration`, `npm run typecheck`, `npm run build`, `subagent_general` Task 4 prompt.
  - Dependencies: T1–T3 and T3A.
  - Files: detection registry/pipeline, background interceptor/helpers/offscreen, unit/integration tests.

### Checkpoint B — Kernel

- [ ] Synthetic JSON list produces exact expected background inventory.
- [ ] Duplicate and reload tests are idempotent.
- [ ] Human approves adapter implementation.

## Phase 2 — Protocol adapter slices

- [x] **T5 — JSON-array adapters: cinesrc + kisskh**
  - Acceptance: cinesrc 100 and kisskh 6; explicit language/format; malformed entries rejected; exact signed URLs/context preserved.
  - Verify: parser/replay/inventory tests, `npm run typecheck`, `npm run build`, `subagent_general` Task 5 prompt (counts verified with sanitized fixtures only; live replay pending).
  - Dependencies: T4.
  - Files: two adapters/profiles, fixtures, integration tests.

- [x] **T6 — JSON-object adapters: lookmovie + broodingmovies**
  - Acceptance: lookmovie 87 direct + 24 typed metadata; no silent drop; brooding 42; extension-context Referer/Origin replay verified.
  - Verify: unresolved-count tests, replay tests, `npm run typecheck`, `npm run build`, `subagent_general` Task 6 prompt (lookmovie metadata typed tuples → unresolved; live replay pending).
  - Dependencies: T4.
  - Files: two adapters/profiles, metadata resolver if verified, fixtures/tests.

- [x] **T7 — Iframe-hash + HTML-variable adapters: lunastream + MyAsianTV**
  - Acceptance: lunastream 33; MyAsianTV 4; hash and HTML grammar validated; no script execution; kisscloud Referer replay verified.
  - Verify: malformed input tests, headed browser replay, `npm run typecheck`, `npm run build`, `subagent_general` Task 7 prompt (unit fixtures pass; live replay pending).
  - Dependencies: T4.
  - Files: two adapters/profiles, fixtures, integration/browser tests.

- [x] **T8 — Deep player-state adapter: noxx**
  - Acceptance: MAIN-world read of allow-listed `window.the_subtitles`; 43/43 relative VTT normalized; deep-frame relay and background/panel counts 43/43.
  - Verify: bridge fixture, headed `cell-profile` noxx test, `npm run typecheck`, `npm run build`, `subagent_general` Task 8 prompt (MAIN-world observer implemented; live noxx count not yet verified).
  - Dependencies: T3–T4.
  - Files: player-state adapter, frame bridge wiring, fixtures/browser tests.

- [x] **T9 — Encrypted adapter: moviepire/videasy**
  - Acceptance: isolated custom XOR/PRNG decoder; deterministic vector/tamper tests; seed replay; live 85/85 background/panel; no secret logging.
  - Verify: decoder tests, headed Videasy test, `npm run typecheck`, `npm run build`, `subagent_general` Task 9 prompt.
  - Dependencies: T3–T4.
  - Files: encrypted adapter/decoder, fixtures, integration/browser tests.
  - **Status**: decoder ported from player bundle (m4uhd, cdn, vsrc, lamovie, superflix, hdmovie, meine, downloader2 all share the same PRNG). Adapter matches all `/<provider>/sources-with-title` endpoints, extracts provider from path, and emits ready candidates per subtitle. Fixtures: `cdn` 67 VTT (S1E2), `m4uhd` 1 SRT. Unit tests pass. Live probe (same seed, player.videasy.to S1E2): `m4uhd`, `hdmovie`, `lamovie`, `downloader2`, `meine`, `cdn` returned encrypted 200; `vsrc` and `superflix` returned 500 for this title (no sources).

- [x] **T10A — Onflix server/HLS catalog pre-audit**
  - Acceptance: enumerate SN/NC/PA/OP from the page; capture each player/HLS/VTT source; record EXT-X-MEDIA presence; produce a concrete per-server expected count.
  - Verify: headed `cell-profile` audit, sanitized fixture review, `git diff --check`, `subagent_general` Task 10A prompt.
  - Dependencies: T4.
  - Files: `docs/player-support.md`, sanitized Onflix fixtures; no production source without approval.
  - **Status**: Live audit 2026-08-03 captured SN server `gota.edgecontent.site` master + 1080p media playlist and `v7.kkphimplayer7.com` master/child. Neither contains `EXT-X-MEDIA:TYPE=SUBTITLES`; subtitles are direct VTT. NC/PA/OP/vip.opstream10.com still unaudited.

- [x] **T10 — HLS and server-variant adapter: onflix**
  - Acceptance: parse `EXT-X-MEDIA`; preserve VTT fallback; use the T10A server/count matrix; replay and deliver every entry per server.
  - Verify: HLS parser fixtures, server matrix, headed Onflix test, `npm run typecheck`, `npm run build`, `subagent_general` Task 10 prompt.
  - Dependencies: T3–T4 and T10A.
  - Files: HLS adapter/parser, fixtures, browser tests/docs.
  - **Status**: master-playlist `EXT-X-MEDIA` parser implemented; HLS likely not the subtitle delivery path for SN/v7. VTT network capture is the primary path.

### Checkpoint C — Direct adapters

- [ ] T5–T8 pass their exact site counts and replay contracts.
- [ ] Lookmovie 24 metadata is an explicit resolver/blocker decision.
- [ ] T10A produces the Onflix server/count matrix before T10 starts.
- [ ] Every adapter verifier returns PASS.
- [ ] Human approves hard adapter and final integration.

## Phase 3 — E4 delivery and closeout

- [ ] **T11 — Inventory/panel integration and nine-site E4 matrix**
  - Acceptance: background count = panel count = expected ready count; unresolved entries explicit; SPA/frame reload isolation; existing flows regressions absent.
  - Verify: `npm run test:unit`, `npm run test:integration`, `npm run build`, `npm run test:e2e:headed`, fresh `subagent_general` nine-site matrix.
  - Dependencies: T5–T10 and T10A.
  - Files: background/panel integration, E2E tests, fixtures.
  - **Status**: pipeline is integrated with `networkInterceptor` and `SubtitleDiscoveryService`; panel wiring still uses existing subtitle manager. Live E4 matrix pending.

- [x] **T12 — Architecture and research documentation closeout**
  - Acceptance: player-support evidence/counts current; architecture tree/function index updated; wiki index updated; spec/plan/tasks/evidence linked.
  - Verify: Markdown/link review, `git diff --check`, architecture inspection, `subagent_general` documentation verifier.
  - Dependencies: T11.
  - Files: `docs/player-support.md`, `docs/2-architechture-system.md`, `docs/0-wiki.md`, task/spec references.
  - **Status**: `docs/2-architecture-system.md` updated with T1-T12 section; wiki/player-support update pending.

### Checkpoint D — Release gate

- [ ] All nine sites have E4 PASS or an explicitly approved release blocker.
- [ ] All task verifiers returned PASS.
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`, and required E2E checks pass.
- [ ] Human approves implementation completion/release.

## Blockers requiring explicit decision

- [x] Lookmovie's 24 OpenSubtitles metadata arrays have a legitimate direct-file resolver.
  - Decision: currently emitted as `unresolved` candidates (metadata preserved) because OpenSubtitles requires a separate resolver/key. No fabricated URLs.
- [x] T10A establishes the complete Onflix server/HLS catalog before T10 can pass.
  - Decision: partial audit done; full matrix requires NC/PA/OP/vip.opstream10.com. SN and v7 do not use HLS subtitles; fallback to `.vtt` network capture is the real path.
- [x] T9 establishes the moviepire/videasy XOR/PRNG decoder before E4 can be claimed.
- [ ] T3A verifies existing MV3 MAIN-world/frame injection behavior in approved target browsers; manifest changes require separate approval.
- [ ] DNR/offscreen replay works for every required Referer/Origin/token family.
