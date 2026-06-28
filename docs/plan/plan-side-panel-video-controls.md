# Plan — Side Panel Video Controls (Feasibility)

> **Giai đoạn**: G1 — Feasibility & Scope
> **Input**: `docs/intent/intent-side-panel-video-controls.md`
> **Ngày**: 2026-06-28

## Feasibility Assessment

### Build vs Buy vs Reuse
| Capability | Build | Buy/Dep | Reuse codebase | Verdict |
|---|---|---|---|---|
| Spacebar → toggle play/pause | ✅ | — | `TOGGLE_PLAY` message (đã có từ spacebar feature) | **Reuse message** |
| Hotkeys (a/d/s/w/t) from panel | ✅ | — | `handleShortcutKey` pure function + `DEFAULT_KEYBOARD_SHORTCUTS` | **Reuse pure function** |
| Cue-seeking logic (prev/next/replay) | ✅ | — | content-script existing switch-case | **Reuse logic** |
| Media clear on navigation | ✅ | — | `networkInterceptor.clearTab` + `clearSessionMedia` (dùng trong `onTabRemoved`) | **Reuse existing methods** |
| Background relay (panel → content) | ✅ | — | `handleSeekTo` / `handleTogglePlay` pattern | **Reuse pattern** |

**Verdict**: Build, reuse codebase tối đa. Không dependency mới. Không abstraction mới.

### Technical Feasibility
- **Message passing**: Side Panel → background → content-script (2 hops, ~10-20ms) — đủ cho hotkey response
- **`handleShortcutKey` pure function**: đã export từ `subtitleShortcuts.ts`, import trực tiếp vào side panel — không cần duplicate logic
- **Shortcuts load async**: `chrome.storage.local.get('settings')` — panel start với defaults, update khi storage load xong
- **Media clear**: `onTabUpdated` loading event fires trên mọi navigation (SPA + full reload) — reliable

### Risks
| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Spacebar scroll page | UX annoyance | High | `e.preventDefault()` khi không focus input |
| Hotkey conflict với browser shortcuts | Hotkey không fire | Low | `e.preventDefault()` + check editable target |
| `toggle-panel` từ trong panel | No-op (đã ở panel) | Certain | Skip action, no-op |
| Media clear mất media khi SPA navigation không reload | Media biến mất tạm thời | Low | Accept — media re-detect sau navigation |
| Content-script chưa inject khi panel gửi hotkey | Message dropped | Low | Content-script inject trên page load, panel mở sau |

## Scope

### In scope
- Spacebar → `TOGGLE_PLAY` message → background relay → content-script `video.play()`/`video.pause()`
- Hotkeys (a/d/s/w/t) → `SHORTCUT_ACTION` message → background relay → content-script cue-seeking + overlay toggle
- Media clear on `onTabUpdated` loading event
- Lint fix pre-existing errors (MockedFunction type + response.data cast)

### Out of scope
- Volume control từ panel
- Arrow key seek (left/right)
- Fullscreen toggle từ panel
- Remap Spacebar

## References
- `docs/intent/intent-side-panel-video-controls.md` — intent
- `docs/adr/008-side-panel-subtitle.md` — Side Panel architecture (parent)
- `src/content/subtitleShortcuts.ts` — `handleShortcutKey` (reuse)
- `src/background/index.ts` — `handleSeekTo` / `handleTogglePlay` (pattern reuse)
