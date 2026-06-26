# ADR-005: Subtitle Floating Panel — Inline DOM, Bilingual Delimiter, CS Shortcuts

## Status
Proposed

## Context
Feature subtitle sidebar + shortcuts (spec: `docs/specs/subtitle-sidebar-shortcuts.md`) cần:
- Floating panel draggable hiển thị cue list (bilingual)
- Keyboard shortcuts (a/d/s/w/t) remappable
- Lazy load cue list (IntersectionObserver)
- Smooth seek + auto-scroll + highlight

**Constraints:**
- Content script runs in isolated world — không truy cập page `window`
- Overlay hiện tại (`subtitleUI.ts`) dùng inline DOM + inline styles, KHÔNG dùng Shadow DOM
- Ponytail rung 2 (reuse codebase): pattern overlay hiện tại = inline DOM, follow pattern
- Chrome MV3: content script có DOM access, không có `chrome.tabs`

**Forces:**
- Shadow DOM = style isolation tốt, nhưng diverge từ pattern hiện tại (overlay dùng inline)
- Inline DOM = consistent với overlay hiện tại, nhưng CSS leak risk (page CSS ảnh hưởng panel)
- Bilingual SRT: cần format đơn giản, parse được, fallback single-language

## Decision

### D1: Panel dùng inline DOM + inline styles (KHÔNG Shadow DOM)
Follow pattern overlay hiện tại (`subtitleUI.ts`). Panel appended vào `video.parentElement`, inline styles cho tất cả elements. CSS class prefix `vd-subtitle-panel-*` để tránh collision.

**Rationale**: Ponytail rung 2 (reuse codebase). Overlay hiện tại đã work với inline DOM, không có CSS leak issue. Thêm Shadow DOM = divergence + complexity không cần thiết.

### D2: Bilingual SRT delimiter = dòng lẻ/dòng chẵn trong cùng cue block
```
1
00:00:01,000 --> 00:00:03,000
Target language text here    ← dòng lẻ (target)
Native language text here    ← dòng chẵn (native)
```
- Target = dòng 1 (lẻ), Native = dòng 2 (chẵn)
- Single-language SRT (1 dòng/cue) → `nativeText = ''`
- Fallback: nếu cue có 1 dòng → target only; nếu > 2 dòng → dòng cuối = native, rest = target

**Rationale**: Đơn giản nhất, không cần custom delimiter. Reuse `parseSrt` từ `srtParser.ts`, chỉ split text block.

### D3: Keyboard shortcuts handler = pure function trong content script
`handleShortcutKey(key, shortcuts, target)` — pure function, không side effects. Content script wiring: `keydown` listener → `handleShortcutKey` → action → controller method.

**Guard**: Check `e.target` không phải `<input>`, `<textarea>`, `[contenteditable]`. Prevent default khi match.

**Rationale**: Pure function = testable (TDD). Content script có DOM access, không cần background. Shortcuts stored trong `chrome.storage.local` → load on init.

### D4: Lazy load = IntersectionObserver, fallback render all nếu < 50 cues
- `renderCueListLazy(panel, cues, observer)` — render chỉ visible items
- IntersectionObserver trigger render thêm khi scroll
- Fallback: nếu `cues.length < 50` → render all (skip observer overhead)

**Rationale**: Ponytail rung 4 (native platform — IntersectionObserver là native browser API). Fallback cho small lists tránh overhead.

### D5: Settings storage = `chrome.storage.local` key `settings.keyboardShortcuts`
Extend `Settings` interface với `keyboardShortcuts: KeyboardShortcut[]`. Default trong `config.ts`: a/d/s/w/t. Popup SettingsDialog thêm tab "Shortcuts" remap key.

**Rationale**: Reuse existing settings pattern (`popupStore.ts` `loadPersistedSettings` migration). Content script load shortcuts on init via `chrome.storage.local.get`.

## Consequences
- **Positive**: Consistent với overlay pattern, ít code mới, testable pure functions
- **Negative**: CSS leak risk (page CSS ảnh hưởng panel) — mitigate bằng class prefix `vd-subtitle-panel-*`
- **Negative**: Bilingual format không standard (không có official bilingual SRT spec) — mitigate bằng fallback single-language
- **Neutral**: Shortcuts chỉ active trong content script (không global) — acceptable cho extension

## Alternatives Considered
- **Shadow DOM cho panel**: Style isolation tốt hơn, nhưng diverge từ overlay pattern + complexity. Rejected (ponytail rung 2).
- **Custom delimiter cho bilingual** (vd `---`): Explicit hơn, nhưng break standard SRT parsers. Rejected (reuse `parseSrt`).
- **Background keyboard handler** (chrome.commands): Global shortcuts, nhưng manifest `commands` limited to 4 keys + không dynamic remap. Rejected (need 5+ keys + remap).
- **Virtual scrolling library** (vd react-window): Better perf cho huge lists, nhưng new dependency + overkill cho < 1000 cues. Rejected (ponytail rung 5 — IntersectionObserver native).
