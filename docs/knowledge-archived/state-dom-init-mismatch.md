# State-DOM init mismatch (learned while fixing subtitle panel bugs)

> **Principle**: [State init must match DOM init](principles.md#state-init-must-match-dom-init)

## Problem

4 bugs blocking phát hiện qua MCP browser test, 3/4 có cùng root cause: **state variable khởi tạo không match DOM property ban đầu**.

| Bug | State init | DOM init | Mismatch |
|---|---|---|---|
| #1 Toggle button ẩn | (no state) | `display: none` | User không thể click toggle → panel không mở được |
| #3 Panel không auto-show | `panelVisible = false` | `display: none` | Sau import, state stays false → panel không hiện |
| #4 `w` toggle cần 2 lần | `overlayVisible = true` | `display: none` | State nói "visible" nhưng DOM nói "hidden" → lần `w` đầu set `false` → `display: none` (vẫn none, no change) → lần 2 mới `true` → `display: block` |
| #6 Popup crash | (no migration) | `keyboardShortcuts: undefined` | SettingsDialog gọi `.find()` trên `undefined` → throw → popup blank |

## Root causes

### Cơ chế: 2 nguồn truth (state variable + DOM property)

```typescript
// content-script.ts — CÁCH A (đang dùng): Closure variables + style.display
let panelVisible = false;        // ← nguồn truth 1: state
panel = createPanel(video);      // ← createPanel set display: none (nguồn truth 2: DOM)
// → 2 nguồn truth phải sync thủ công, dễ quên
```

Khi toggle:
```typescript
panelVisible = !panelVisible;           // flip state
panel.style.display = panelVisible ? 'flex' : 'none';  // flip DOM
// → Nếu state init ≠ DOM init, lần toggle đầu đi sai hướng
```

### Cơ chế: Storage migration thiếu field mới

```typescript
// popupStore.ts — trước fix:
const raw = data[STORAGE_KEYS.SETTINGS] as Settings | undefined;
// raw.keyboardShortcuts = undefined (settings cũ không có field này)
set({ settings: raw });  // → SettingsDialog nhận keyboardShortcuts: undefined
// SettingsDialog: settings.keyboardShortcuts.find(...) → TypeError
```

## Fix

### Fix #1: Toggle button `display: flex` (match "always visible")
```typescript
// subtitlePanel.ts — createToggleButton:
btn.style.display = 'flex';  // ← was 'none' — toggle luôn visible, panel ẩn/hiện
```

### Fix #3: Auto-show panel sau import
```typescript
// content-script.ts — sau renderCueListLazy:
panelVisible = true;              // ← sync state
panel.style.display = 'flex';     // ← sync DOM
```

### Fix #4: `overlayVisible = false` (match overlay `display: none`)
```typescript
// content-script.ts — init:
let overlayVisible = false;  // ← was true — match overlay initial display:none
```

### Fix #6: Migration fills `keyboardShortcuts`
```typescript
// popupStore.ts — loadPersistedSettings:
if (!settings.keyboardShortcuts || settings.keyboardShortcuts.length === 0) {
  settings = { ...settings, keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS };
}
```

## Key insight

Khi có **2 nguồn truth** (state variable + DOM property), chúng **phải sync ban đầu**. Nếu không, toggle đầu tiên sẽ đi sai hướng — state flip nhưng DOM không thay đổi (hoặc ngược lại).

Rule: **State init = DOM init**. Nếu DOM `display: none`, state phải `false`. Nếu DOM `display: flex`, state phải `true`.

Cách phòng tránh: **Single source of truth** — dùng 1 trong:
- **DOM as state**: `panel.style.display === 'none'` → không cần `panelVisible` variable
- **`hidden` attribute**: `panel.hidden = true/false` — native, single source
- **CSS class**: `classList.toggle('hidden')` — declarative, CSS controls display

## Verification

### MCP browser test Round 2 — all 7 ACs PASS:
- BUG #1: Toggle `display: flex` → click → panel show (none → flex → none) ✅
- BUG #3: Import subtitle → panel auto-show (`display: flex`) ✅
- BUG #4: `w` toggle overlay works first try (none → block → none → block) ✅
- BUG #6: Settings dialog opens, "Keyboard shortcuts" section renders, 5 inputs (a/d/s/w/t) ✅

### Unit tests: 1086 pass, typecheck pass, no regression.

## Alternative mechanisms (có những cách nào)

### State management — 4 cách:
1. **Closure variables** (đang dùng) — đơn giản, không dependency, nhưng 2 nguồn truth
2. **Class controller** (SubtitleOverlayController) — encapsulated, `this.panelVisible` + `this.panel.style.display` cùng class
3. **Zustand store** — reactive, testable, nhưng overkill cho content script
4. **DOM as state** — `panel.style.display === 'none'` → single source of truth, không cần variable

### DOM visibility — 4 cách:
1. **`style.display`** (đang dùng) — imperative, 2 nguồn truth, dễ mismatch
2. **CSS class** — `classList.toggle('hidden')` + `.hidden { display: none }` — declarative
3. **`hidden` attribute** — `panel.hidden = true/false` — native HTML, single source
4. **Data attribute + CSS** — `[data-visible="false"] { display: none }` — declarative + queryable

### Storage migration — 2 cách:
1. **Fill defaults in migration** (đang dùng, fix #6) — defensive, backward-compatible
2. **Guard in consumer** — `settings.keyboardShortcuts?.find(...) ?? []` — defensive nhưng lặp ở mỗi consumer

## Pattern: Migration vs Guard

| Tiêu chí | Migration (cách 1) | Guard (cách 2) |
|---|---|---|
| **Where** | 1 chỗ (loadPersistedSettings) | Mỗi consumer (SettingsDialog, content-script) |
| **Diff size** | 1 guard ở migration | N guards ở N consumers |
| **Ponytail** | "fix shared function once" ✅ | "one guard per caller" ❌ |
| **Risk** | Miss 1 field → crash tất cả consumers | Miss 1 consumer → crash 1 chỗ |

**Ponytail rule**: "grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller" → **Migration wins**.
