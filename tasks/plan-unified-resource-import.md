# Implementation Plan: Unified Resource Import

## Overview

Gộp dictionary + frequency thành một resource architecture: một dropzone, content-derived component detection, một entry store (`langDictionaryEntry` giữ tên vật lý, freq rows stamp `kind:'freq'`), migration v14, `type` còn là derived label. Spec: `docs/specs/unified-resource-import.md`. Concept đã chọn: A (flat unified list). Worktree: `../cell-worktrees/unified-resource-import`, branch `unified-resource-import`.

## Architecture Decisions

- **Một entry store**: freq rows vào `langDictionaryEntry` với `kind:'freq'`; dict rows không stamp (absent=dict) → migration chỉ copy freq rows, không chạm ~500k dict rows.
- **`type` = derived label**: giữ trên ResourceInfo + wire meta cho compat; nghiệp vụ nhánh theo `components`/payload, không theo type khai báo.
- **Không ambiguity-prompt**: mọi format quyết được bằng content (zip bank names, sqlite schema, JSON shape); override = component deselect trên file multi-component.
- **Component mới `'frequency'`**: DictionaryComponent + zod enum + label i18n; freq resources tự có toggle.
- **Portable format giữ byte-identical**: `STRIPPED_FIELDS` chỉ thêm `kind`; `backwardTerm` giữ serialize; `contentHash` ổn định.
- **FREQUENCY_GET thêm resource gate** (enabled + không disable 'frequency') — bug-fix delta ghi rõ (rank rò từ resource disabled hôm nay).
- **In-session sequential build** — lanes song song được cân nhắc nhưng file overlap nặng (types.ts, schemas, handlers chia sẻ giữa các slice) → sequential slices trong worktree.

## Task List

### Phase 1: Foundation — types, store, migration

- [ ] Task 1: Types + schemas (`DictionaryComponent+'frequency'`, entry union, zod drops)
- [ ] Task 2: Unified entry repository + v14 migration + tests

### Checkpoint: Foundation

- [ ] `npm run typecheck` green; migration test v13→v14 pass trên fake-indexeddb

### Phase 2: Detection + import pipeline

- [ ] Task 3: Format→componentSet detection + sqlite schema sniff + tests
- [ ] Task 4: Strategy plumbing (no resourceType, dual emit, component fold) + tests
- [ ] Task 5: Import path (`importFile` sans type, chunk payload, SAMPLE/FIND/REORDER, devSeed)

### Checkpoint: Import

- [ ] Mixed zip → resource components {definitions, frequency}; unit tests green

### Phase 3: Query + sync parity

- [ ] Task 6: FREQUENCY_GET gate + projection (bug-fix delta)
- [ ] Task 7: lookupOrchestrator components-derived filters
- [ ] Task 8: Sync (portable partition, contentHash, dictLocalSource stores/wordCount/components/phrase-index)

### Checkpoint: Parity

- [ ] FREQUENCY_GET parity test; portable round-trip test

### Phase 4: UI + sweep + docs

- [ ] Task 9: ResourcesPanel một section + badge + picker + ResourceCard chips + i18n
- [ ] Task 10: Sweep remaining `resourceType`/type-branch sites + fix tests
- [ ] Task 11: Docs (architecture, ADR, wiki) + delete mockup + gates + browser verify

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Migration copy trong versionchange tx chậm | Med | cursor-copy + test trên fixture lớn; abort-safe atomic |
| `ResourcesPanel.test.tsx` rewrite lớn | Med | rewrite theo hành vi mới, giữ coverage các flows (dedupe, duplicate prompt, scheduler) |
| sync-on-use (deliver, agent khác) đụng dictLocalSource | Med | branch riêng; merge-time conflict expected → rebase khi ship |
| Dirty files agent khác trong main worktree | Low | đã cách ly bằng worktree riêng + `.cell-owner` |
| Sót type-branch trong sweep | Med | grep-gate SC-14: `type === 'DICTIONARY'|'FREQUENCY'` và `resourceType` |

## Open Questions

- Không còn — spec đã chốt: không ambiguity-prompt, không đổi tên store, kind asymmetry ghi ADR.
