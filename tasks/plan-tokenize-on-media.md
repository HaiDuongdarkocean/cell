# Implementation Plan: Tokenize on Media

## Overview

Build Tokenize on Media feature: a float badge lets users toggle tokenization of English web pages and video subtitles. Vocabulary is highlighted by status/frequency using a lazy, viewport-driven tokenizer optimized for 1GB RAM. Status/IPA lookup flows through the existing Popup Dictionary.

## Architecture Decisions

- New feature domain `src/features/tokenize/` (FSD + Screaming Architecture) to keep the domain isolated from `dictionaryPopup` and `subtitle`.
- Vanilla TS for the content-script badge and token spans (lighter than React for 1GB RAM; consistent with existing subtitle overlay code).
- Token spans live in host DOM text flow, styled via an injected global stylesheet with `!important` on critical visual properties to resist host CSS overrides.
- Badge and mini panel live in a Shadow DOM root with explicit token injection (`tokens.css?raw`, remapped `:root` → `:host`).
- Tokenization lifecycle: `prepare` (idle metadata) → `bind` (DOM spans, < 16.7ms) → `unbind` (cleanup) per block/cue.
- Memory: bounded LRU cache, `WeakMap` DOM → data mapping, soft/hard cleanup.
- Per-domain enable state stored in `chrome.storage.local` with schema version.

## Task List

### Phase 1: Foundation — entities + pure logic + cache + scheduler

- [ ] Task 1: Define tokenize entities/types (`src/entities/tokenize/types.ts`, `src/features/tokenize/types.ts`)
- [ ] Task 2: Implement text tokenizer (`src/features/tokenize/logic/textTokenizer.ts`)
- [ ] Task 3: Implement LRU cache (`src/features/tokenize/logic/tokenizeCache.ts`)
- [ ] Task 4: Implement idle scheduler (`src/features/tokenize/logic/tokenizeScheduler.ts`)
- [ ] Task 5: Implement block boundary detection (`src/features/tokenize/logic/tokenizeBlock.ts`)

### Checkpoint: Phase 1
- [ ] `npm run test:unit` passes for tokenizer, cache, scheduler, block.
- [ ] `npm run typecheck` passes.

### Phase 2: Viewport & Rendering

- [ ] Task 6: Implement viewport tracker (`src/features/tokenize/logic/viewportTracker.ts`) using IntersectionObserver sentinel + rootMargin
- [ ] Task 7: Implement token span renderer + host-page stylesheet (`src/features/tokenize/ui/tokenSpanRenderer.ts`, `tokenSpanCss.ts`)
- [ ] Task 8: Implement badge + mini panel Shadow DOM (`src/features/tokenize/ui/tokenBadge.ts`, `tokenBadgeCss.ts`)

### Checkpoint: Phase 2
- [ ] `npm run test:unit` passes for viewport tracker + renderer.
- [ ] Badge renders in jsdom/isolated test.

### Phase 3: State & Settings

- [ ] Task 9: Implement per-domain tokenize settings store (`src/features/tokenize/model/tokenizeSettingsStore.ts`)
- [ ] Task 10: Implement tokenize state store (selected tokens, hovered token, status/frequency toggles) (`src/features/tokenize/model/tokenizeStateStore.ts`)

### Checkpoint: Phase 3
- [ ] `npm run test:unit` passes for stores.

### Phase 4: Controllers & Web Text Integration

- [ ] Task 11: Implement tokenize controller + web text controller (`src/features/tokenize/controller/tokenizeController.ts`, `webTextTokenizeController.ts`)
- [ ] Task 12: Wire content script integration (`src/entrypoints/content/tokenizeHostIntegration.ts`; modify `content-script.ts`)
- [ ] Task 13: Add keyboard handlers (1/2/3/4, Ctrl/Cmd+click multi-select, Escape) (`src/features/tokenize/ui/tokenKeyboardHandler.ts`)

### Checkpoint: Phase 4
- [ ] Text page tokenization works on sample HTML in browser MCP.
- [ ] Badge toggles work; memory snapshot stable on scroll.

### Phase 5: Subtitle Integration

- [ ] Task 14: Implement subtitle tokenize controller (`src/features/tokenize/controller/subtitleTokenizeController.ts`)
- [ ] Task 15: Integrate subtitle cue time-window with existing subtitle overlay (`features/subtitle/ui/subtitleBlockController.ts` or new wiring)

### Checkpoint: Phase 5
- [ ] Subtitle cues tokenize within time-window; seek cleans up old cues.

### Phase 6: Popup Dictionary Integration & Polish

- [ ] Task 16: Add Popup Dictionary message endpoints (`features/dictionaryPopup/controller/webTextDictionaryController.ts` or `services/wordStatusStore.ts`)
- [ ] Task 17: Add mobile tap → open Popup Dictionary; desktop hover + key status change
- [ ] Task 18: Final quality gates: `npm run test:unit`, `npm run typecheck`, `npm run lint`, browser MCP verify

### Checkpoint: Phase 6 (Complete)
- [ ] All acceptance criteria met.
- [ ] `docs/2-architechture-system.md` updated with new files.
- [ ] Test report written to `docs/test-reports/<date>-tokenize-on-media-mcp.md`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Host CSS overrides token spans | High | Inject stylesheet with explicit reset + `!important` on critical properties; test on multiple sites. |
| 1GB RAM device lag | High | VDLT: only viewport+buffer, LRU cache, chunk scheduling, WeakMap. |
| Subtitle cue DOM changes on seek | Medium | Time-window viewport + cleanup; listen to video `seeking`/`timeupdate`. |
| Popup Dictionary API changes | Medium | Define interface first; integrate after tokenization core works. |
| SPA navigation leaks observers | Medium | `destroy()` clears observers, caches, styles; proactive clear on `popstate`/`yt-navigate-finish`. |

## Open Questions

1. Should badge be React inside Shadow DOM to reuse `shared/ui`, or vanilla TS for lighter footprint? (Plan picks vanilla.)
2. Exact buffer size and cache limit? (Defer to tuning in Task 6/11; start with 2 viewport / 50 cues.)
3. Should `prepare` run in a Web Worker? (Defer; start with main-thread idle scheduling; measure.)
4. Should token spans reuse `WordHighlight` span or a new `cell-token` span? (Plan picks new span for status/frequency styling.)
