# Principles — Engineering Lessons Index

> **Layer 1 (this file)**: abstract principles — scan nhanh, cross-project, không coupled codebase.
> **Layer 2 (case study files)**: technical detail — problem, fix, verification. Link từ "Cases" bên dưới.
> Khi gặp bug mới: grep file này → đọc tên nguyên lý → biết liên quan không → click case study nếu cần detail.

## Khái niệm hóa template (sau khi test pass + debug pass)

Khi fix bug → test pass → khái niệm hóa thành nguyên lý (abstract principle) để apply cho nhiều trường hợp.
Invoke `/conceptualization` skill cho full workflow.

### Layer 1 — Principle entry (thêm vào file này)
```markdown
## <Tên nguyên lý> (ngắn, abstract)

### Nguyên lý
<1-2 câu mô tả nguyên lý, không cụ thể case>

### Cases đã gặp
- [case-study-file.md](case-study-file.md) — <1 câu tóm tắt case>

### Apply cho
- <Tình huống khác nguyên lý này đúng>
- <Framework/library khác có pattern tương tự>
```

### Layer 2 — Case study file (`docs/knowledge/<case-name>.md`)
```markdown
# <Case name> (specific, codebase-coupled)

> **Principle**: [<principle name>](principles.md#<anchor>)

## Problem
<What happened, symptoms>

## Root causes
<Why it happened, code paths>

## Fix
<What changed, which files>

## Key insight
<1-2 sentences abstract — why the fix works>

## Verification
<Evidence the fix works: test results, live debug output>
```

### Bidirectional links (bắt buộc)
- Case study top: `> **Principle**: [link to principles.md#anchor]`
- Principle "Cases": `[link to case-study.md] — summary`

### Khi nào khái niệm hóa (5 triggers)
1. **Bug fix verified** — test pass + root cause understood (GĐ 7)
2. **Feature implementation insight** — code pass + pattern reusable (GĐ 4)
3. **Architecture decision** — ADR written or design decision made (GĐ 3)
4. **Refactor discovery** — code pass + simplification pattern found (GĐ 4)
5. **Cross-cutting pattern** — same logic appears 2+ times in codebase (GĐ 4-7)

### Khi nào KHÔNG khái niệm hóa
- Bug là 1-off (không tái sử dụng được)
- Bug là business logic (không phải pattern framework)
- Code chưa verified (test fail)
- Trivial one-liner (ponytail: no insight to abstract)
- No insight beyond "I implemented the spec" (spec-driven, no surprise)

---

## Broadcasts fan out → scope by identifier

### Nguyên lý
Broadcasts fan out to every listener — cannot target specific listener. Scope by identifier in payload, listener filters by identifier.

### Cases đã gặp
- [tab-scoping-popup-leak.md](tab-scoping-popup-leak.md) — chrome.runtime.sendMessage broadcasts to all tabs → pass tabId in payload, popup filters by tabId

### Apply cho
- chrome.runtime.sendMessage (Chrome extension)
- WebSocket rooms (server broadcasts to all rooms, client filters by roomId)
- Event emitters (EventEmitter emits to all listeners, filter by event type)
- Database queries (query returns all rows, filter by WHERE clause)

---

## Separate dedup from catch-up

### Nguyên lý
Separate "don't redo" (dedup) from "allow new items" (catch-up). Use id-level dedup for items already processed, allow re-run for new items.

### Cases đã gặp
- [auto-download-subtitle-catchup.md](auto-download-subtitle-catchup.md) — URL guard (coarse) blocked subtitle catch-up → id-level dedup (fine) allows catch-up without re-downloading video

### Apply cho
- Incremental processing (polling with diff)
- Caching with invalidation (cache by id, invalidate by key)
- Data synchronization (sync by id, allow new items)

---

## Gather candidates + filter by explicit criteria

### Nguyên lý
Don't assume query results match intent. Gather candidates from several query shapes, then filter by explicit criteria.

### Cases đã gặp
- [edge-app-window-leak.md](edge-app-window-leak.md) — chrome.tabs.query({ active: true, currentWindow: false }) returned app-window tab → gather 3 query shapes + filter chrome-extension:// URLs

### Apply cho
- chrome.tabs.query (Chrome extension)
- Database queries with complex WHERE (gather rows, filter by criteria)
- API responses with mixed data types (gather all, filter by type)

---

## Hybrid detection: fast single-candidate first, disambiguation second

### Nguyên lý
When detecting from noisy input, use fast deterministic stage first (single-candidate resolves immediately), expensive probabilistic stage second (only for ambiguous multi-candidate cases).

### Cases đã gặp
- [subtitle-language-detection.md](subtitle-language-detection.md) — script detection (26 scripts, single-candidate resolves immediately) → frequency disambiguation (38 profiles, only for Latin/Cyrillic/Arabic/Devanagari/Han)

### Apply cho
- Language detection (script → frequency, charset → n-gram)
- Spam filtering (rule-based first, ML second)
- Type inference (literal type first, flow analysis second)
- Any detection pipeline with cheap-then-expensive stages

---

## Dead field → link by co-occurrence, not by dead reference

### Nguyên lý
When a foreign key field is never populated by the producer, don't try to fix the producer. Link by co-occurrence (same scope/context) instead — it's robust to producer bugs.

### Cases đã gặp
- [subtitle-filename-matches-video.md](subtitle-filename-matches-video.md) — subtitle.videoId never set by detector → link by tabId (all subtitles on a video page belong to that page's video)

### Apply cho
- Orphaned foreign keys (field exists but never set)
- Event correlation (link events by timestamp window, not by correlationId)
- Log enrichment (link log lines by request scope, not by traceId if missing)

---

## Same codec config → share init segment, patch timeline offsets

### Nguyên lý
When merging fMP4 fragments from the same source stream, they share codec configuration. Strip duplicate init segments (keep only first), patch tfdt offsets cumulatively, update mvhd duration.

### Cases đã gặp
- [parallel-fmp4-merge.md](parallel-fmp4-merge.md) — parallel transmux splits TS into N groups, each emits own ftyp+moov + rebased tfdt → strip parts 1+ ftyp+moov, patch tfdt with cumulative offset, update mvhd duration

### Apply cho
- fMP4 concatenation (mux.js, ffmpeg wasm)
- HLS segment merging (same codec → share init)
- Any fragmented media merge where fragments share codec config but have independent timeline baselines

## State init must match DOM init

### Nguyên lý
Khi có 2 nguồn truth (state variable + DOM property), chúng phải sync ban đầu. Nếu không, toggle đầu tiên sẽ đi sai hướng — state flip nhưng DOM không thay đổi (hoặc ngược lại). Rule: nếu DOM `display: none`, state phải `false`; nếu DOM `display: flex`, state phải `true`.

### Cases đã gặp
- [state-dom-init-mismatch.md](state-dom-init-mismatch.md) — subtitle panel: 3/4 blocking bugs có cùng root cause (overlayVisible=true vs display:none, panel không auto-show, toggle ẩn) + storage migration thiếu keyboardShortcuts → popup crash

### Apply cho
- Content script state (closure variables + DOM style) — Chrome extension, userscript
- React state vs DOM ref (useState + useRef + imperative DOM mutation)
- Storage migration (old settings thiếu field mới → fill defaults ở migration, không guard mỗi consumer)
- Any UI với 2 nguồn truth: state variable + DOM property phải sync init
