# Spec Review — condensed-audio

Spec đầy đủ cấu trúc (Actor boundary, REQ 1–7 có basic/alt/exception + postcondition, NFR số hoá, data entity, traceability, SC-1..10, OQ deferred đúng mode `all`). Mọi claim infra verify được: JobRegistry cap/dedupe (`jobRegistry.ts:32,244`), DB `orca-local-player`, resumable Drive upload, `public/ffmpeg/`, JUMP + captureStream precedents. Intent coverage: N1–N6 → SC, journey TO-BE 1–4, stories S1–S4 đều map.

Blockers: (không có)

Major:
1. [REQ-5] [TL/PO]: Action "reveal file" không có API trong Chrome extension — FileSystemFileHandle không reveal được trong OS file manager; `chrome.downloads.showInFolder` chỉ áp cho downloads. Fix: đổi thành "save a copy" (`showSaveFilePicker`) hoặc route export qua chrome.downloads nếu muốn reveal.
2. [REQ-4] [TL]: "job finalize → null → system yêu cầu user chọn (mở picker)" — `showDirectoryPicker` cần transient user activation; finalize chạy nền không mở được picker tự động. Fix: finalize set `exportState=pending` + surface action để user gesture mở picker.
3. [REQ-1 Rules] [BA]: "một source → một record" mâu thuẫn "retry tạo record mới nếu failed". Fix: retry supersede record cũ.

Minor:
1. [REQ-7] [PO]: "cancel" chưa có flow/postcondition (record status? `.part` cleanup?).
2. [REQ-5] [TL]: Race delete-item-trong-lúc-job-chạy (finalize ghi record đã xoá).
3. [REQ-3] [PO]: Placeholder ">N s" chưa có giá trị.
4. [Boundaries/SC] [PO]: Intent AC i18n en/vi không có SC assert.
5. [Boundaries] [BA]: "Ask first: dependency mới" unreachable trong mode `all` — resolve conservative: nếu ffmpeg + WebCodecs đều fail → `failed` có reason, không thêm dep.
6. [REQ-3] [TL]: MediaRecorder bitrate không định → size NFR-2 khó kiểm.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

| Finding | Applied |
|---|---|
| M1 reveal file không khả thi | REQ-5: "reveal file" → "save a copy" qua `showSaveFilePicker` |
| M2 picker cần user gesture | REQ-4: finalize set `exportState=pending`, picker chỉ mở từ action user bấm; SC-5 giữ nguyên (test qua action đó) |
| M3 rule record mâu thuẫn | REQ-1: "một source → một record non-terminal; retry supersede record cũ" |
| m1 cancel semantics | REQ-7 alt flow: cancel → abort runner/recorder → cleanup `.part`/output tạm → record `failed` reason `cancelled` |
| m2 race delete-vs-finalize | REQ-5 exception: finalize check record tồn tại, absent → discard output |
| m3 `>N s` | REQ-3: pause session khi dừng >10s |
| m4 i18n AC | SC-10 += "mọi chuỗi user-facing mới có i18n đủ en/vi" |
| m5 dep fallback | Boundaries: không thêm dep trong item này; ffmpeg+WebCodecs fail → `failed` có reason |
| m6 bitrate | REQ-3: target ~96kbps, browser default fallback, revisit nếu >45MB/giờ |
