# Intent: Quản lý Audio nén (Condensed Audio)

> Slug: `condensed-audio` · Mode: interactive · Source: backlog row #20 (idea-grab 2026-10-01; migaku condensed audio export + impd/AJATT + Condenser) — gộp scope từ `condensed-playback` (dropped: capability in-player đã shipped qua `skipNoDialogue`)
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Người immersion muốn nạp input trong thời gian inactive (ra ngoài, nấu ăn, tập) — audio gốc ~50% là không-thoại nên density thấp và không portable | user direction 2026-10-01; Condenser/AJATT ghi nhận condensed audio ngắn hơn ~50% (ercanserteli.com/condenser, ajatt.top/blog/passive-listening) | high |
| Change | Hiện tại Cell chỉ phục vụ immersion khi đang xem (video + cues); tương lai: mọi video có cues sinh ra một file audio chỉ-gồm-thoại mang đi mọi nơi | backlog #20 pain; hiện không có export audio nào ngoài clip 15s của cardCreator | high |
| Solution | Một pipeline "condense": cắt audio theo cue ranges (+padding) → ghép → xuất mp3 — hai leg sản xuất: file-based (ffmpeg offscreen) cho media tải được, realtime record (JUMP playback + captureStream) cho streaming không tải được | user direction: "hai hướng… tải về rồi condense ra mp3; không tải được thì recording lại rồi ghép → mp3" | high |
| Value | Biến dead-time thành immersion; ~2x language density so với nghe nguyên bản; đóng vòng "xem → nghe lại" của immersion loop | AJATT/impd rationale; Migaku Player ship condensed audio export như flagship | high |
| Stakeholder | Immersionist theo chủ nghĩa immersion (Anh) — persona 5–80 tuổi, RAM ≥1GB | AGENTS.md persona | high |
| Context | MV3 extension, local-first, ffmpeg wasm vendored, OPFS storage, Drive sync tồn tại | `public/ffmpeg/`, `src/entrypoints/offscreen/ffmpegRunner.ts`, `src/features/sync` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Cell maintainer | Cần ffmpeg pipeline mới (atrim/concat/encode) + record session ổn định | ffmpeg-core.wasm đã vendored (kiểm chứng encoder mp3 ở SPECIFY); offscreen + jobs infra sẵn |
| Customer | Immersionist | File nghe được mọi nơi kể cả phone, không thao tác thủ công | Persona rộng — UI phải đơn giản, progress rõ |
| Supplier/Dependency | ffmpeg wasm core, File System Access API, MediaRecorder/captureStream | mp3 encode trong wasm build; `showDirectoryPicker` cần user gesture + secure context | ffmpeg vendored; picker đã chạy từ shadow-DOM panel (`LocalPronunciationSettingsPanel.tsx:84`) |
| Organization | Repo Cell | Không phá local-first, không dep nặng | không thêm dep nếu ffmpeg core sẵn có encoder phù hợp |
| Regulator | Chrome Web Store policy, bản quyền nội dung | Record audio stream = sao chép nội dung có bản quyền cho personal use — cùng phong vị rủi ro với download feature đã ship | `download`/`transmux` feature đã tồn tại; giữ local-first, không phát tán |

## Needs

| ID | Need | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Sinh file audio chỉ-gồm-thoại từ video có cues | F | cue timings persist (`mediaLibraryRepository` subtitles store); JUMP precedent chứng minh cue-boundary skipping đúng | high |
| N2 | Leg A — media tải được: condense nhanh hơn realtime (đọc file, không cần phát lại) | F, P | FileSystemFileHandle persist trong `VideoRecord.fileHandle` (`mediaLibraryRepository.ts:51`); OPFS downloads; ffmpeg offscreen runner | high |
| N3 | Leg B — media không tải được (streaming): record trong khi phát với gap tự skip | F, R | `video.captureStream()` + MediaRecorder precedent `sentenceAudio.ts`; `skipNoDialogue=JUMP` đã ship | medium — long-session capture stability chưa chứng minh |
| N4 | Output dùng được mọi nơi: lưu disk theo path user chọn + trong tab "Playlist" của extension + option sync Drive | S, +infra | user direction; dir-handle persist pattern `splitArchiveDirectoryHandleId`; Drive sync infra | high |
| N5 | Job chạy nền có progress + sống sót restart | R | `jobs`/`entities/job` durable registry shipped 2026-09-28 | high |
| N6 | Padding/tolerance quanh cue boundary để audio tự nhiên | U | Condenser default 500ms padding | medium |

## Scope

- **In:** entry action trong subtitle panel (cover cả streaming + local player vì local player cũng dùng subtitle panel); leg A ffmpeg condense từ file handle/OPFS; leg B realtime record session (JUMP + captureStream); mp3 output; "Playlist" tab mới liệt kê các file condensed + sync-Drive action per item; setting export path (unset → dialog chọn path); job progress/recovery.
- **Out:** video không có cues (đó là `speech-to-sub`, backlog riêng); edit/trim tay từng đoạn; live-listen trong extension trong lúc ghi leg B; DRM-protected sources khi captureStream bị chặn (Netflix — fail-closed với thông báo).
- **Non-goals:** đây không phải in-player condensed playback (đã có `skipNoDialogue`); không phải podcast RSS hosting; tab "Playlist" về sau mở rộng watch-later/đã-xem — item này chỉ dựng phần condensed-audio playlist.

## Workflow

Người dùng đang xem (stream) hoặc mở video trong local player → subtitle panel có action "Condensed audio". Hệ thống phân nhánh: media có file handle/OPFS → leg A, chạy ffmpeg trong offscreen dưới một durable job, cắt theo cue ranges + padding, ghép, encode mp3, ghi vào export dir (path từ settings; chưa có → mở dialog chọn thư mục rồi persist handle id) và đăng ký item vào tab Playlist. Streaming không có file → leg B: một "record session" phát video ở 1x với JUMP bật, captureStream → MediaRecorder audio-only; kết thúc video hoặc user dừng → encode/ghép → mp3 → cùng đích đến. Tab Playlist hiển thị tiến trình (JobRow) và từng item có action sync lên Drive. Nhân quả system↔system: job hoàn thành → broadcast → playlist refresh; sync Drive dùng infra `sync` hiện có.

## Journey

### AS-IS
1. User xem xong một tập trên streaming hoặc local player; muốn nghe lại lúc ra ngoài.
2. Không có đường nào trong tool: chỉ có thể xem lại video (cần màn hình, đầy khoảng lặng) hoặc tự dùng tool ngoài (sub2cia/Condenser) — cần file video + sub trên desktop, thao tác nhiều bước.
3. Với streaming không tải được thì bất khả thi hoàn toàn → user bỏ qua, mất toàn bộ dead-time.

### TO-BE
1. User mở video bất kỳ có cues → bấm "Condensed audio" trong subtitle panel.
2. Downloadable: job ffmpeg chạy nền, nhanh hơn realtime → mp3 xuất hiện trong Playlist + thư mục đã chọn. Non-downloadable: record session phát+ghi tới hết; user biết thời lượng và tiến trình.
3. User mở tab Playlist → thấy file, nghe thử hoặc bấm sync Drive → trên phone mở Drive/podcast player nghe được ngay. Dead-time trở thành immersion time.
4. Edge: hết cues giữa chừng/sub lỗi → job fail-closed với lý do; captureStream bị DRM chặn → báo không record được, gợi ý leg A nếu có file.

## Stories

- S1: As an immersionist, I want mọi video tôi đã xem biến thành một file audio chỉ-gồm-thoại so that tôi nghe lại trong lúc di chuyển/làm việc nhà — done when file mp3 xuất hiện trong Playlist và/hoặc thư mục export mà không cần tool ngoài.
- S2: As an immersionist, I want condense từ video trên streaming không tải được so that nguồn nào có sub cũng thành listening material — done when record session hoàn tất và xuất mp3 tương đương leg A.
- S3: As a user, I want chọn một lần thư mục export và đổi được sau so that file luôn về đúng chỗ tôi quản lý — done when path persist, unset thì được hỏi chọn, và file ghi đúng vào đó.
- S4: As a user, I want một chỗ xem lại/quản lý các file condensed so that tôi biết mình có gì để nghe và đẩy lên Drive khi cần — done when Playlist tab liệt kê items + trạng thái job + action sync.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| ffmpeg wasm build thiếu mp3 encoder (libmp3lame) hoặc concat filter lỗi với nguồn lạ | internal | Leg A chết hoặc phải xuất m4a/opus thay mp3 | Verify encoder trong SPECIFY spike; fallback encode opus + đổi contract output |
| Leg B captureStream bị DRM/EICC chặn (Netflix) hoặc tab background throttle MediaRecorder | external | Leg B fail trên một số site; session đứt giữa chừng | Fail-closed + báo rõ; thử `chrome.tabCapture` (cần permission mới) như fallback; resume-checkpoint theo cue |
| Record realtime buộc tab sống 45'+ — user đóng tab mất cả session | human/operational | Mất work | Jobs registry + checkpoint resume; cảnh báo trước khi start |
| File mp3 lớn × nhiều video → disk/Drive quota | operational | Đầy storage | Hiển thị size; chất lượng/bitrate setting ở SPECIFY |
| Bản quyền: trích audio nội dung streaming | legal | Store review risk | Same envelope as download feature; local-first, không chia sẻ |
| "Playlist" tab mơ hồ phạm vi tương lai (watch-later…) | hidden | Scope creep | Intent ghi rõ: item này chỉ làm condensed-audio playlist; mở rộng là item khác |

## Decision

go — pain thật, infra leverage cao (vendored ffmpeg, offscreen, jobs, dir-handle persist, Drive sync, JUMP + captureStream precedents); rủi ro lớn nhất (mp3 encoder, DRM capture) đều có fallback hoặc fail-closed path. User đã chốt: cả hai leg, output disk+Playlist+Drive sync, entry subtitle panel.

## Draft Acceptance Criteria

- [ ] Từ subtitle panel, video local/downloaded có cues → một mp3 chỉ-gồm-thoại xuất hiện trong export dir + Playlist; thời lượng < video gốc (các khoảng không-cue bị cắt).
- [ ] Streaming có cues nhưng không tải được → record session hoàn tất → mp3 tương đương; DRM-blocked → fail với lý do rõ, không treo.
- [ ] Export path unset → prompt chọn thư mục, persist cho lần sau, đổi được trong settings.
- [ ] Job hiển thị progress + sống sót SW/browser restart theo contract `jobs` hiện hữu.
- [ ] Playlist tab: liệt kê items, nghe thử, sync Drive per item.
- [ ] i18n đủ en/vi; token/component theo design system; không console.log.
