# saveSettings partial wipe (learned while fixing nav cluster drag reset)

> **Principle**: [Partial save must read-modify-write, not merge with defaults](principles.md#partial-save-must-read-modify-write-not-merge-with-defaults)

## Problem

Mở settings popup cấu hình nav cluster (buttonSize=56, bgOpacity=0.3,
buttonOpacity=0.5) → kéo drag nav cluster trên video page để đổi vị trí →
toàn bộ config (trừ vị trí) reset về default (buttonSize=48, bgOpacity=0.7,
buttonOpacity=0.9).

Cùng bug class: `offsetController.persistOffset` gọi
`saveSettings({ subtitleOffset: updated })` → wipe TẤT CẢ settings khác
(nav cluster, overlay style, download config, ...) về default — chưa được
phát hiện vì offset feature mới, drag là case đầu tiên trigger.

## Root causes

### `saveSettings` merge với DEFAULT_SETTINGS, không merge với stored

```ts
// BUG:
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const toStore = { ...DEFAULT_SETTINGS, ...settings, schemaVersion };
  await setStorage({ [STORAGE_KEYS.SETTINGS]: toStore });
}
```

Bất kỳ field nào không có trong `settings` (partial) → lấy từ DEFAULT_SETTINGS
→ reset về default. Caller truyền partial (chỉ 1-2 field) → wipe mọi field khác.

### Callers partial vs full

| Caller | Payload | Behavior trước fix |
|---|---|---|
| `popupStore.updateSettings` | full (`{...state.settings, ...partial}`) | OK — merge full với DEFAULT = full |
| `background UPDATE_SETTINGS` | full (`{...current, ...payload}`) | OK |
| `subtitleOverlay.persistStyle` | full (`{...settings, [style]: ...}`) | OK |
| `contentScriptController:802` | full (`{...settings, subtitlePreference}`) | OK |
| `navClusterController.persistSettings` | **partial** (`{navClusterPosition}`) | **BUG — wipe nav cluster fields** |
| `offsetController.persistOffset` | **partial** (`{subtitleOffset}`) | **BUG — wipe ALL fields** |

## Fix

`saveSettings` read-modify-write — load current stored settings, merge partial,
write back:

```ts
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const toStore = { ...current, ...settings, schemaVersion: CURRENT_SCHEMA_VERSION };
  await setStorage({ [STORAGE_KEYS.SETTINGS]: toStore });
}
```

### Recursion guard

`loadSettings` persist-back migration (line 127) trước đây gọi `saveSettings(result)`.
Sau khi `saveSettings` gọi `loadSettings` → infinite recursion (loadSettings →
migrate → saveSettings → loadSettings → migrate → ...). Fix: migration persist-back
gọi `setStorage` trực tiếp, không qua `saveSettings`.

Callers truyền full settings (popup, background, subtitleOverlay) không bị ảnh
hưởng — full merged với full = full (idempotent).

## Key insight

Partial save API (`saveSettings(Partial<Settings>)`) ngầm định merge với state
hiện tại, nhưng implementation merge với DEFAULT → semantic mismatch. Khi thiết
kế API nhận `Partial<T>`, phải rõ ràng: merge với current state (read-modify-write)
hay replace toàn bộ (caller truyền full). Nếu partial → bắt buộc read-modify-write,
không thể merge với default (default chỉ là fallback cho field thiếu trong stored,
không phải base cho mọi save).

## Verification

- Regression test `saveSettings partial preserves existing stored fields` ✅
  (settingsStoreNavCluster.test.ts — buttonSize 56, bgOpacity 0.3, buttonOpacity
  0.5 preserved after `saveSettings({ navClusterPosition })`)
- 23 settingsStore tests pass ✅
- `tsc --noEmit` ✅, `eslint` clean ✅
- **Browser verify (Edge MCP)**: set non-default nav cluster storage → reload →
  simulate border drag → read storage: position changed (20,30 → 24.34,34.63),
  buttonSize=56 preserved, bgOpacity=0.3 preserved, buttonOpacity=0.5 preserved ✅
- Extension Errors page: 0 issues ✅
