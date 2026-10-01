# Intent: Quản lý Phát nén

> Slug: `condensed-playback` · Mode: interactive · Source: backlog row #17 (idea-grab 2026-10-01, asbplayer condensed playback)
> ui_surface: no
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Người immersion mất thời gian vào khoảng không-thoại (intro, cảnh im lặng) khi xem chủ động | backlog row #17 pain | high |
| Change | Hiện tại đã có: `skipNoDialogue` JUMP/2X–8X skip hoặc tua khoảng không-cue trong lúc phát | `src/entities/studyMode/types.ts:79`, `src/features/studyModes/lib/studyModePlaybackController.ts:363-374` | high |
| Solution | Không cần — capability tồn tại; mong muốn thật của user là **file audio nén** (mp3) chứ không phải playback mode | user direction 2026-10-01 | high |
| Value | Đã hiện thực hóa qua setting có sẵn | `src/features/studyModes/ui/StudyModesTab.tsx:29-44` (Select OFF/2X/4X/6X/8X/JUMP) | high |
| Stakeholder | Immersionist xem video với sub | backlog | high |
| Context | Feature đã ship + có UI + sync qua `settingsRegistry` (`src/features/sync/domain/settingsRegistry.test.ts:206`) | codebase | high |

## Needs

| ID | Need | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Bỏ qua khoảng không-thoại trong lúc xem | F | `skipNoDialogue` JUMP + speed multipliers đã implement + test cover (`studyModePlaybackController.test.ts:199-224`) | high |

## Scope

- **In:** (không có — capability đã tồn tại)
- **Out:** condensed audio export → chuyển sang `condensed-audio` (backlog #20), gồm leg streaming không-tải-được (JUMP playback + record tab audio → mp3) theo user direction
- **Non-goals:** đổi tên/re-surface control hiện có

## Journey

### AS-IS
1. User xem video có sub, gặp đoạn intro/cảnh im lặng dài.
2. User mở Study Modes → Advanced → bật `skipNoDialogue` JUMP hoặc 2X–8X.
3. Playback controller tự seek/speed qua khoảng không-cue — pain đã được giải.

### TO-BE
1. Không có thay đổi — behavior mong muốn đã là AS-IS.
2. Nhu cầu file mp3 condensed được định nghĩa lại trong `condensed-audio`.
3. Backlog row này đóng để tránh trùng capability.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Discoverability của `skipNoDialogue` thấp (tên không gợi "condensed") | human | Low — user đã biết setting tồn tại | Đổi label/preset sau nếu cần, không cần item riêng |

## Decision

no-go — capability đã shipped (`skipNoDialogue` JUMP/2X–8X, UI + sync + tests); phần user thật sự muốn (file mp3 condensed, 2 legs downloadable/non-downloadable) được gộp vào `condensed-audio` #20.
