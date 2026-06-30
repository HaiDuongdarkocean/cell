# Intent — Bilingual Subtitle Auto-Load

> Output của `interview-me` (Giai đoạn 0 — Discovery). Confirmed by user.

## Outcome
Mở rộng subtitle overlay auto-load từ 1 sub (target) thành 2 sub song ngữ (target + native), tự động phát hiện + load khi vào trang web có video.

## User
Anh yêu (người học ngôn ngữ) — cần thấy target (en/zh/...) + native (vi) cùng lúc để đối chiếu.

## Why now
Hiện tại overlay chỉ auto-load 1 sub target (`findSubtitleForOverlay` trả 1 match); muốn hoàn thiện quy trình tự động song ngữ để học hiệu quả hơn.

## Success
Vào trang web có video + 2 sub (target + native) → overlay tự hiện cả 2 dòng, panel list song ngữ, không cần thao tác manual.

## Constraints (confirmed decisions)
1. **Overlay hiển thị**: cả 2 dòng cùng overlay (target trên, native dưới).
2. **Align strategy**: runtime align (không pre-merge) — mỗi `timeupdate` tìm cue target + cue native active độc lập.
3. **Panel list**: theo target + native best-effort (pre-merge cho panel, native rớt → trống).
4. **Partial load**: khi chỉ có 1 sub → vẫn load; sub thứ 2 đến sau → ghép bổ sung.
5. **2 flow song song**: drag-drop bilingual SRT (cũ, giữ nguyên `parseBilingualSrt`) + auto-load 2 file riêng (mới).
6. **Settings UI**: 2 `CustomSelect` single-select (target language + native language), reuse list `SUBTITLE_LANGUAGES` đã có. Default native = `vi`, default target = `en` (hoặc trống → không auto-load target).
7. **Trigger architecture**: background quyết định sub nào (dựa settings) + gửi URL xuống content-script; content-script fetch + parse + hiển thị.
8. **Multi-sub cùng ngôn ngữ**: khi 2+ sub cùng target language → dropdown trong overlay cho user chọn sub mong muốn.

## Out of scope
- Không thay thế flow `parseBilingualSrt` hiện có.
- Không smart-merge timestamp (chấp nhận lệch nhẹ giữa 2 sub).
- Không MultiSelect cho target/native (đều single-select).
- Không popup `SubtitleCard` "Use for overlay" (chọn sub qua dropdown overlay).

## Existing context (codebase)
- `src/background/subtitleService.ts` — `findSubtitleForOverlay(subtitles, settings)` trả 1 match (cần mở rộng trả 2: target + native).
- `src/content/subtitleAutoLoad.ts` — `shouldAutoLoad`, `validateOverride` (config 1 target).
- `src/content/subtitleOverlay.ts` — `SubtitleOverlayController` load 1 bộ `SrtCue[]`.
- `src/content/subtitleBilingualParser.ts` — `parseBilingualSrt` (1 file interleaved).
- `src/content/subtitlePanel.ts` — panel list `BilingualCue[]`.
- `src/types/media.ts` — `Settings.subtitleOverlayTargetLanguage` + `subtitleOverlayAutoLoad` (cần thêm `subtitleOverlayNativeLanguage`).
- `src/popup/components/settings/SettingsDialog.tsx` — có `CustomSelect` + `SUBTITLE_LANGUAGES` list (reuse).
