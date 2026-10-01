# Design brief — condensed-audio · Playlist tab + trigger + record pill

> Spec: `docs/specs/condensed-audio.md` · Mockup: `src/entrypoints/mockup-condensed-audio/` · Mode: `all` (single justified variant) · Decision question: **where does a speech-only audio file live and how does the user get it out?**

## Design Read

One line: condensed audio là một *thư viện file* — user tạo từ video đang xem, rồi quay lại sau để nghe/lấy file ra ngoài; surface phải là một shelf (list) chứ không phải control inline của player.

## Function audit

| Function | Class | Why |
|---|---|---|
| Start condense từ video đang xem | must-have | REQ-1 — entry subtitle panel |
| Show job progress + terminal state | must-have | REQ-7 — durable job visibility |
| List condensed items (title/duration/size/status/source) | must-have | REQ-5 |
| Play/pause preview trong panel | must-have | REQ-5 |
| Save a copy ra nơi user chọn | must-have | REQ-4/5 — exportState=pending → picker action |
| Sync Drive per item | must-have | REQ-6 |
| Delete item (OPFS + record) | must-have | REQ-5 |
| Retry failed item | must-have | REQ-5 |
| Record-session indicator + stop trên video (leg B) | must-have | REQ-3 — user phải thấy và dừng được session đang ghi |
| Config export dir trong Settings | must-have | REQ-4, SC-5 — "đổi path được trong settings" |
| Aggregate/watch-later views | remove | spec non-goal — watch-later là item sau |
| Auto-upload Drive | remove | NFR-4 — chỉ user-initiated |

Primary job: **user mở Playlist và ngay lập tức thấy file nào xong/đang chạy/lỗi, bấm play hoặc lấy ra ngoài trong ≤2 chạm.**

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Có video + cues | mở subtitle manager → bấm "Condensed audio" | job `condenseAudio` bắt đầu; toast/row xuất hiện | SubtitleManagerPanel header |
| 2a | Leg A (file) | chờ | progress % trong Playlist + job row | Playlist tab |
| 2b | Leg B (record) | video phát tới hết / bấm stop | record pill `● REC mm:ss` trên video; finalize → item ready | overlay pill + Playlist |
| 3 | Quay lại sau | mở panel → tab Playlist | list items mới nhất trước | Playlist tab |
| 4 | Nghe thử | bấm play trên row | inline `<audio>` preview từ OPFS blob | item row |
| 5 | Lấy file ra | bấm save-copy / chọn folder export | `showSaveFilePicker` / `showDirectoryPicker` (user gesture) | item row / pending banner |
| 6 | Nghe trên phone | bấm sync Drive | upload → `driveFileId` + synced state | item row |
| Edge | export dir chưa set | job xong | `exportState=pending` → banner action "Chọn thư mục export" trên item | item row |
| Edge | item failed (DRM/OOM/cancel) | đọc | reason i18n + retry + delete | item row |
| Edge | job chạy, panel đóng | mở lại | JobRow rebuild từ registry (durable-job-registry contract) | Playlist tab |

Moments of uncertainty: "file kia xong chưa?", "session record còn chạy không?", "file nằm ở đâu trên disk?"

## Dials (baseline)

- DESIGN_VARIANCE: 2 — tái dùng row language của vocabulary/jobs + nav pattern sẵn có
- MOTION_INTENSITY: 2 — progress fill, status flip instant (aria-live)
- VISUAL_DENSITY: 6 — compact rows, touch ≥44px, persona 5–80

## Variant duy nhất — "Media shelf" (media shelf trong tab mới)

**IA mental model:** Playlist là shelf — mỗi condensed audio là một "quyển cassette" trên kệ: row có tên, độ dài, trạng thái, hành động. Tab mới ngang hàng Dictionary/Vocabulary/Study modes/Settings — người immersion coi nó như "podcast app mini" trong panel.

**Visual archetype:** solid list rows (row language của `durable-job-registry` ImportJob + vocabulary list): status icon leading, title sm/medium truncate, meta xs secondary, action ghost-sm buttons trailing.

**Layout (desktop sidebar tab):**
```
┌─ Universal panel ─────────────────────┐
│ header (tab nav + Playlist active)    │
├───────────────────────────────────────┤
│ [job row] ⏳ Condensing "Tập 12"  42% │  ← JobRow (registry-driven)
│ ───────────────────────────────────── │
│ ▸ 名探偵 Ep.12 — condensed.mp3        │  ← item row: leading status
│   24:36 · 18.2 MB · mp3 · Drive ✓     │    icon; meta line; trailing
│   [▶ preview] [↓ copy] [↻ sync] [🗑]  │    icon buttons (ghost sm)
│ ───────────────────────────────────── │
│ ● …recording… "Đang ghi" 12:04 [stop] │  ← leg-B session row
│ ───────────────────────────────────── │
│ empty state: icon + "Chưa có audio…"  │
└───────────────────────────────────────┘
```

**Record pill (leg B, trên video):**
```
┌─ overlay bottom-right ──┐
│ ● REC 12:04   [■ Stop]  │  ← circle stop button, overlay variant
└─────────────────────────┘
```

**SubtitleManagerPanel trigger:** thêm circle Button `audioWave` vào hàng action header sẵn có; disabled + tooltip "cần subtitle" khi không có cues.

**Settings → Media card:** row "Condensed audio export folder" — giá trị path/hiển thị "Not set" + Button "Choose" (`folderOpen`) — cùng row language của các setting hiện hữu.

**3 dials:** VARIANCE 2 · MOTION 2 · DENSITY 6
**Why it fits:** shelf = mental model file-library đúng nghĩa; mọi element reuse row/icon/button grammar đã ship; không invent navigation mới; Playlist sau này ôm watch-later mà không đổi IA (vẫn là shelf).
**Risk:** tab thứ 5 làm bottom nav đông — resolve bằng short-label convention sẵn có (precedent `vocabularyShort`/`studyModesShort` i18n keys) + nav compaction ≤400px (label xs hoặc icon-only); Tools sheet button giữ nguyên vị trí.

## Responsive

| Width | Behavior |
|---|---|
| 320px | rows full-width; actions wrap ra dòng 2 (icon-only buttons); meta truncate 1 line |
| 768px | giống 320, actions cùng hàng |
| 1280px+ | panel fixed width — không đổi |

## States

- Item: `processing` (progress bar, spinner) / `ready` / `failed` (reason + retry + delete) / `missing` (OPFS file mất → re-run) / `exportState: pending|done|failed`
- Recording session: `recording` (pill + row, elapsed) / `paused` (video dừng >10s) / `finalizing`
- Playlist: `empty` (icon + CTA hướng dẫn) / populated
- Trigger button: enabled / disabled-no-cues / busy (job running cho cùng source)

## Audit-fit

- No Liquid Glass — solid `--input-bg` rows trong `--card-background` panel.
- Touch targets ≥44px — ghost sm buttons trong row ≥44px (precedent verified trong durable-job-registry mapping).
- `aria-live='polite'` trên status flips; record pill `role='status'`.
- i18n en/vi mọi string mới.
